package com.joao_v_marques.certificados_cooperados.repository;

import com.joao_v_marques.certificados_cooperados.entity.CourseCertificate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface CourseCertificateRepository extends JpaRepository<CourseCertificate, Integer> {

    /**
     * O que o download precisa saber de um certificado: onde está o arquivo, com
     * que nome ele volta para o usuário e a que curso pertence.
     *
     * É projeção, e não a entidade, porque `course` é LAZY e o download acontece
     * fora da transação — a leitura do título estouraria com a sessão fechada.
     */
    interface CertificateFile {
        Integer getId();

        String getStoredPath();

        String getOriginalFilename();

        String getContentType();

        String getCourseTitle();

        LocalDate getCompletionDate();
    }

    @Query("""
            select cert.id as id,
                   cert.storedPath as storedPath,
                   cert.originalFilename as originalFilename,
                   cert.contentType as contentType,
                   cert.course.title as courseTitle,
                   cert.course.completionDate as completionDate
            from CourseCertificate cert
            where cert.id = :id
            """)
    Optional<CertificateFile> findFileById(@Param("id") Integer id);

    // Os certificados de um cooperado no ano-base, que é o recorte do zip: o
    // mesmo período da lista de cursos do detalhe, para o arquivo baixado bater
    // com o que a tela mostra.
    @Query("""
            select cert.id as id,
                   cert.storedPath as storedPath,
                   cert.originalFilename as originalFilename,
                   cert.contentType as contentType,
                   cert.course.title as courseTitle,
                   cert.course.completionDate as completionDate
            from CourseCertificate cert
            where cert.course.cooperativeMember.id = :memberId
              and cert.course.completionDate between :start and :end
            order by cert.course.completionDate asc, cert.id asc
            """)
    List<CertificateFile> findFilesByMemberAndCompletionDateBetween(@Param("memberId") Integer memberId,
                                                                    @Param("start") LocalDate start,
                                                                    @Param("end") LocalDate end);
}
