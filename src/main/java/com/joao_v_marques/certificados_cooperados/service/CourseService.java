package com.joao_v_marques.certificados_cooperados.service;

import com.joao_v_marques.certificados_cooperados.dto.CourseRequest;
import com.joao_v_marques.certificados_cooperados.dto.CourseResponse;
import com.joao_v_marques.certificados_cooperados.entity.CooperativeMember;
import com.joao_v_marques.certificados_cooperados.entity.Course;
import com.joao_v_marques.certificados_cooperados.entity.CourseCertificate;
import com.joao_v_marques.certificados_cooperados.entity.User;
import com.joao_v_marques.certificados_cooperados.repository.CooperativeMemberRepository;
import com.joao_v_marques.certificados_cooperados.repository.CourseCertificateRepository;
import com.joao_v_marques.certificados_cooperados.repository.CourseRepository;
import com.joao_v_marques.certificados_cooperados.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Set;

@Service
public class CourseService {

    private final CourseRepository courseRepository;
    private final CooperativeMemberRepository cooperativeMemberRepository;
    private final UserRepository userRepository;
    private final CourseCertificateRepository courseCertificateRepository;
    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd_HHmmss");
    private final Path certificatesDirectory;

    private static final Set<String> ALLOWED_TYPES = Set.of("application/pdf", "image/jpeg", "image/png");
    private static final long MAX_SIZE_BYTES = 10L * 1024 * 1024;

    public CourseService(CourseRepository courseRepository, CooperativeMemberRepository cooperativeMemberRepository, UserRepository userRepository, CourseCertificateRepository courseCertificateRepository, @Value("${app.certificados.diretorio}") String certificatesDirectory) {
        this.courseRepository = courseRepository;
        this.cooperativeMemberRepository = cooperativeMemberRepository;
        this.userRepository = userRepository;
        this.courseCertificateRepository = courseCertificateRepository;
        this.certificatesDirectory = Paths.get(certificatesDirectory).toAbsolutePath().normalize();
    }

    // POST de um novo curso, faz a inserção também do certificado, grava os dois juntos ou nenhum
    @Transactional
    public CourseResponse create(CourseRequest request, MultipartFile certificate, Integer currentUserId) {
        validateCertificate(certificate);

        // resolve as FK's e dá erro se não existir
        CooperativeMember cooperativeMember = cooperativeMemberRepository.findById(request.cooperativeMemberId())
                .orElseThrow(() -> new IllegalArgumentException("Cooperado não encontrado."));
        User insertedBy = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalStateException("Usuário responsável não encontrado."));

        // regra de negócio que a anotação de validation das dto's não cobre
        if (!cooperativeMember.isActive()) {
            throw new IllegalArgumentException("Este cooperado está inativo.");
        }

        // montar a entidade, o DTO nunca vira entidade sozinho
        Course course = new Course();
        course.setTitle(request.title());
        course.setTotalMinutes(request.totalMinutes());
        course.setCompletionDate(request.completionDate());
        course.setObservations(request.observations());
        course.setCooperativeMember(cooperativeMember);
        course.setInsertedBy(insertedBy);

        Course saved = courseRepository.save(course);

        // Lógica para inserção do certificado
        String folder = folderSlug(cooperativeMember.getName());

        String fileName = StringUtils.getFilename(certificate.getOriginalFilename());
        String base = folderSlug(StringUtils.stripFilenameExtension(fileName));
        String extension = StringUtils.getFilenameExtension(fileName);
        String stamp = LocalDateTime.now().format(STAMP);

        String storedPath = folder + "/" + base + "_" + stamp + (extension != null ? "." + extension.toLowerCase() : "");

        CourseCertificate cert = new CourseCertificate();
        cert.setCourse(saved);
        cert.setOriginalFilename(fileName);
        cert.setContentType(certificate.getContentType());
        cert.setStoredPath(storedPath);
        cert.setSizeBytes((int) certificate.getSize());
        courseCertificateRepository.save(cert);

        saveOnDisk(certificate, storedPath);

        // transforma a entidade para dto de saída(response) e retorna
        return toResponse(saved);
    }

    // transforma a entidade para DTO de saída, utilizado no retorno do create
    // precisa de rodar dentro da transação: cooperativeMember e insertedBy são LAZY
    private CourseResponse toResponse(Course course) {
        return new CourseResponse(
                course.getId(),
                course.getTitle(),
                course.getTotalMinutes(),
                course.getCompletionDate(),
                course.getObservations(),
                course.getCreatedAt(),
                course.getCooperativeMember().getName(),
                course.getInsertedBy().getName() != null
                        ? course.getInsertedBy().getName()
                        : course.getInsertedBy().getUsername()
        );
    }

    // Função para gravar o arquivo em disco (Nas pastas). Chamado por último dentro da transação
    private void saveOnDisk(MultipartFile file, String storedPath) {
        try {
            Path destination = certificatesDirectory.resolve(storedPath).normalize();

            // Garantia, o destino precisa de estar dentro da pasta de certificados
            if (!destination.startsWith(certificatesDirectory)) {
                throw new IllegalArgumentException("Caminho de destino inválido.");
            }

            // Cria storage/certificados/<cooperado>/ se ainda não existir
            Files.createDirectories(destination.getParent());

            try (InputStream in = file.getInputStream()) {
                Files.copy(in, destination);
            }

        } catch (IOException e) {
            // Precisa de ser unchecked: exceção checada não dispara rollback sozinha
            throw new UncheckedIOException("Falha ao gravar o certificado em disco", e);
        }
    }

    private String folderSlug(String text) {
        if (text == null || text.isBlank()) {
            return "sem-nome";
        }
        String withoutAccentMark = Normalizer.normalize(text, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        String clear = withoutAccentMark.toLowerCase()
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        return clear.isBlank() ? "sem-nome" : clear;
    }

    private void validateCertificate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Anexe o arquivo do certificado.");
        }
        if (!StringUtils.hasText(file.getOriginalFilename())) {
            throw new IllegalArgumentException("Não foi possível identificar o nome do arquivo enviado.");
        }
        if (file.getSize() > MAX_SIZE_BYTES) {
            throw new IllegalArgumentException("O certificado deve ter no máximo 10MB.");
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType.toLowerCase())) {
            throw new IllegalArgumentException("O certificado deve ser um arquivo PDF, JPG ou PNG.");
        }
    }
}
