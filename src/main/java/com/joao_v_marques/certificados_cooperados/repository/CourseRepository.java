package com.joao_v_marques.certificados_cooperados.repository;

import com.joao_v_marques.certificados_cooperados.entity.Course;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface CourseRepository extends JpaRepository<Course, Integer> {

    /**
     * Projeção enxuta para o relatório anual: um curso vira o cooperado dono, a
     * carga horária — que é do que a regra de pontos precisa — e a marcação de
     * cooperativismo, que alimenta o indicador de capacitados.
     *
     * O apelido é `cooperativism` e não `isCooperativism` só para o getter não
     * virar getIsCooperativism(); a coluna e o campo da entidade seguem com o
     * prefixo.
     */
    interface MemberCourseMinutes {
        Integer getCooperativeMemberId();

        Integer getTotalMinutes();

        Boolean getCooperativism();
    }

    // Traz os cursos do ano-base sem carregar a entidade inteira nem os LAZY.
    // A soma de pontos não é feita aqui de propósito: a faixa de pontuação é
    // regra de negócio e mora no CoursePointsPolicy. Pelo mesmo motivo o
    // cooperativismo volta curso a curso, e não como contagem pronta: quem
    // decide o que é "cooperado capacitado" é o service.
    @Query("""
            select c.cooperativeMember.id as cooperativeMemberId,
                   c.totalMinutes as totalMinutes,
                   c.isCooperativism as cooperativism
            from Course c
            where c.completionDate between :start and :end
            """)
    List<MemberCourseMinutes> findMemberMinutesByCompletionDateBetween(@Param("start") LocalDate start,
                                                                       @Param("end") LocalDate end);

    /**
     * Uma linha da lista de cursos do detalhe do cooperado.
     *
     * Traz o certificado junto porque a tela mostra os dois na mesma linha; sem
     * isso seria uma consulta por curso só para saber se existe arquivo.
     */
    interface MemberCourseDetail {
        Integer getId();

        String getTitle();

        Integer getTotalMinutes();

        LocalDate getCompletionDate();

        Boolean getCooperativism();

        Integer getCertificateId();

        String getCertificateFilename();
    }

    // Os cursos de um cooperado no ano-base, do mais recente para o mais antigo.
    //
    // O join do certificado é `left` porque o schema não obriga o curso a ter
    // um: sem isso, um curso sem arquivo sumiria da lista em vez de aparecer sem
    // o botão de download. Um curso tem no máximo um certificado — é o que o
    // lançamento grava —, então o left join não multiplica linha.
    @Query("""
            select c.id as id,
                   c.title as title,
                   c.totalMinutes as totalMinutes,
                   c.completionDate as completionDate,
                   c.isCooperativism as cooperativism,
                   cert.id as certificateId,
                   cert.originalFilename as certificateFilename
            from Course c
            left join CourseCertificate cert on cert.course = c
            where c.cooperativeMember.id = :memberId
              and c.completionDate between :start and :end
            order by c.completionDate desc, c.title asc
            """)
    List<MemberCourseDetail> findDetailsByMemberAndCompletionDateBetween(@Param("memberId") Integer memberId,
                                                                         @Param("start") LocalDate start,
                                                                         @Param("end") LocalDate end);

    // Anos que têm curso concluído, para montar as opções do select de ano-base
    // em vez de deixar a lista fixa no HTML.
    @Query("""
            select distinct year(c.completionDate)
            from Course c
            order by year(c.completionDate) desc
            """)
    List<Integer> findDistinctCompletionYears();
}
