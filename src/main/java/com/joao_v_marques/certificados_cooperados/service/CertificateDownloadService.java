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

@Service
public class CertificateDownloadService {

    private static final Logger log = LoggerFactory.getLogger(CertificateDownloadService.class);

    // Prefixo do nome do arquivo dentro do zip: mantém a ordem cronológica na listagem da pasta.
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

    // Um certificado pronto para virar resposta: arquivo em disco, nome de download e tipo.
    public record CertificateFile(Path path, String downloadName, String contentType) {
    }

    // Um arquivo dentro do zip, já com o nome que ele terá lá dentro.
    public record ArchiveEntry(Path path, String nameInZip) {
    }

    // O zip inteiro, resolvido e conferido, faltando só escrever.
    public record CertificateArchive(String filename, List<ArchiveEntry> entries) {
    }

    @Transactional(readOnly = true)
    public CertificateFile findOne(Integer certificateId) {

        CourseCertificateRepository.CertificateFile found = courseCertificateRepository.findFileById(certificateId)
                .orElseThrow(() -> new IllegalArgumentException("Certificado não encontrado."));

        Path path = certificateStorage.resolve(found.getStoredPath());

        if (!Files.isReadable(path)) {
            log.warn("Certificado {} sem arquivo legível em disco", certificateId);
            throw new IllegalArgumentException("O arquivo deste certificado não está disponível no servidor.");
        }

        return new CertificateFile(path, downloadNameOf(found), contentTypeOf(found));
    }

    @Transactional(readOnly = true)
    public CertificateArchive prepareArchive(Integer memberId, int year) {

        BaseYearPolicy.validate(year);

        CooperativeMember member = cooperativeMemberRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("Cooperado não encontrado."));

        List<CourseCertificateRepository.CertificateFile> found = courseCertificateRepository
                .findFilesByMemberAndCompletionDateBetween(memberId, BaseYearPolicy.start(year), BaseYearPolicy.end(year));

        List<ArchiveEntry> entries = new ArrayList<>(found.size());

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
