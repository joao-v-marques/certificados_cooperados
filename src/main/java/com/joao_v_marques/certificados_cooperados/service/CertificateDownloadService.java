package com.joao_v_marques.certificados_cooperados.service;

import com.joao_v_marques.certificados_cooperados.entity.CooperativeMember;
import com.joao_v_marques.certificados_cooperados.repository.CooperativeMemberRepository;
import com.joao_v_marques.certificados_cooperados.repository.CourseCertificateRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Download de certificado, um a um ou em lote.
 *
 * A divisão em duas etapas — preparar e só depois escrever — é o ponto central
 * daqui. O que pode dar errado (cooperado inexistente, ano fora da faixa, ano
 * sem certificado, arquivo sumido do disco) é resolvido em `prepareArchive`,
 * antes de a resposta começar a sair; `writeZip` só copia bytes. Depois que o
 * primeiro byte foi escrito não dá mais para trocar o status HTTP, e o usuário
 * receberia um zip corrompido no lugar de uma mensagem de erro.
 *
 * Como consequência, a leitura do banco acontece dentro da transação e a leitura
 * do disco fora dela: o que atravessa a fronteira são caminhos já conferidos
 * pelo CertificateStorage, nunca o `stored_path` cru.
 */
@Service
public class CertificateDownloadService {

    private static final Logger log = LoggerFactory.getLogger(CertificateDownloadService.class);

    /** Prefixo do nome do arquivo dentro do zip: mantém a ordem cronológica na listagem da pasta. */
    private static final DateTimeFormatter ENTRY_DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private static final String DEFAULT_CONTENT_TYPE = "application/octet-stream";

    private final CourseCertificateRepository courseCertificateRepository;
    private final CooperativeMemberRepository cooperativeMemberRepository;
    private final CertificateStorage certificateStorage;

    public CertificateDownloadService(CourseCertificateRepository courseCertificateRepository,
                                      CooperativeMemberRepository cooperativeMemberRepository,
                                      CertificateStorage certificateStorage) {
        this.courseCertificateRepository = courseCertificateRepository;
        this.cooperativeMemberRepository = cooperativeMemberRepository;
        this.certificateStorage = certificateStorage;
    }

    /** Um certificado pronto para virar resposta: arquivo em disco, nome de download e tipo. */
    public record CertificateFile(Path path, String downloadName, String contentType) {
    }

    /** Um arquivo dentro do zip, já com o nome que ele terá lá dentro. */
    public record ArchiveEntry(Path path, String nameInZip) {
    }

    /** O zip inteiro, resolvido e conferido, faltando só escrever. */
    public record CertificateArchive(String filename, List<ArchiveEntry> entries) {
    }

    @Transactional(readOnly = true)
    public CertificateFile findOne(Integer certificateId) {

        CourseCertificateRepository.CertificateFile found = courseCertificateRepository.findFileById(certificateId)
                .orElseThrow(() -> new IllegalArgumentException("Certificado não encontrado."));

        Path path = certificateStorage.resolve(found.getStoredPath());

        if (!Files.isReadable(path)) {
            // O registro existe e o arquivo não: é o caso de pasta de
            // certificados apontando para outro lugar, ou de arquivo removido na
            // mão. Vale dizer isso ao usuário em vez de devolver 500.
            log.warn("Certificado {} sem arquivo legível em disco", certificateId);
            throw new IllegalArgumentException("O arquivo deste certificado não está disponível no servidor.");
        }

        return new CertificateFile(path, downloadNameOf(found), contentTypeOf(found));
    }

    /**
     * Resolve todos os certificados do cooperado no ano-base.
     *
     * Certificado cujo arquivo sumiu do disco é descartado com registro no log,
     * e não derruba o lote: o usuário ainda leva os que existem. Se não sobrar
     * nenhum, aí sim é erro — um zip vazio pareceria download bem-sucedido.
     */
    @Transactional(readOnly = true)
    public CertificateArchive prepareArchive(Integer memberId, int year) {

        BaseYearPolicy.validate(year);

        CooperativeMember member = cooperativeMemberRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("Cooperado não encontrado."));

        List<CourseCertificateRepository.CertificateFile> found = courseCertificateRepository
                .findFilesByMemberAndCompletionDateBetween(memberId, BaseYearPolicy.start(year), BaseYearPolicy.end(year));

        List<ArchiveEntry> entries = new ArrayList<>(found.size());

        // Dois cursos com o mesmo título e a mesma data gerariam a mesma entrada;
        // nome repetido dentro de um zip faz descompactador sobrescrever ou
        // recusar o arquivo.
        Set<String> usedNames = new HashSet<>();

        for (CourseCertificateRepository.CertificateFile certificate : found) {
            Path path = certificateStorage.resolve(certificate.getStoredPath());

            if (!Files.isReadable(path)) {
                log.warn("Certificado {} ignorado no zip: sem arquivo legível em disco", certificate.getId());
                continue;
            }

            entries.add(new ArchiveEntry(path, uniqueName(entryNameOf(certificate), usedNames)));
        }

        if (entries.isEmpty()) {
            throw new IllegalArgumentException(
                    "Nenhum certificado disponível para " + member.getName() + " em " + year + ".");
        }

        return new CertificateArchive("certificados_" + Slug.of(member.getName()) + "_" + year + ".zip", entries);
    }

    /** Escreve o zip direto na resposta, sem montar o arquivo inteiro em memória. */
    public void writeZip(CertificateArchive archive, OutputStream output) throws IOException {

        try (ZipOutputStream zip = new ZipOutputStream(output, StandardCharsets.UTF_8)) {
            for (ArchiveEntry entry : archive.entries()) {
                zip.putNextEntry(new ZipEntry(entry.nameInZip()));
                Files.copy(entry.path(), zip);
                zip.closeEntry();
            }
        }
    }

    /**
     * Nome do arquivo dentro do zip: data de conclusão, título do curso e a
     * extensão do original.
     *
     * O nome enviado no upload não serve aqui — "certificado.pdf" repetido vinte
     * vezes não diz nada a quem abre a pasta. Data na frente para a listagem sair
     * em ordem cronológica sozinha.
     */
    private String entryNameOf(CourseCertificateRepository.CertificateFile certificate) {

        LocalDate completionDate = certificate.getCompletionDate();
        String extension = StringUtils.getFilenameExtension(certificate.getStoredPath());

        return ENTRY_DATE.format(completionDate)
                + "_" + Slug.of(certificate.getCourseTitle())
                + (extension != null ? "." + extension.toLowerCase() : "");
    }

    private String uniqueName(String name, Set<String> usedNames) {
        if (usedNames.add(name)) {
            return name;
        }

        String base = StringUtils.stripFilenameExtension(name);
        String extension = StringUtils.getFilenameExtension(name);

        for (int sequence = 2; ; sequence++) {
            String candidate = base + "_" + sequence + (extension != null ? "." + extension : "");

            if (usedNames.add(candidate)) {
                return candidate;
            }
        }
    }

    /**
     * Nome com que o certificado desce sozinho: o do upload, quando ele existe.
     *
     * `getFilename` corta qualquer caminho que tenha vindo junto — o valor foi
     * digitado pelo navegador do usuário e vai para um header de resposta.
     */
    private String downloadNameOf(CourseCertificateRepository.CertificateFile certificate) {

        String original = StringUtils.getFilename(certificate.getOriginalFilename());

        return StringUtils.hasText(original) ? original : entryNameOf(certificate);
    }

    private String contentTypeOf(CourseCertificateRepository.CertificateFile certificate) {
        return StringUtils.hasText(certificate.getContentType())
                ? certificate.getContentType()
                : DEFAULT_CONTENT_TYPE;
    }
}
