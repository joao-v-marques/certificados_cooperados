package com.joao_v_marques.certificados_cooperados.repository;

import com.joao_v_marques.certificados_cooperados.entity.Course;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface CourseRepository extends JpaRepository<Course, Integer> {

    /**
     * Projeção enxuta para o relatório anual: um curso vira só o cooperado dono
     * e a carga horária, que é do que a regra de pontos precisa.
     */
    interface MemberCourseMinutes {
        Integer getCooperativeMemberId();

        Integer getTotalMinutes();
    }

    // Traz os cursos do ano-base sem carregar a entidade inteira nem os LAZY.
    // A soma de pontos não é feita aqui de propósito: a faixa de pontuação é
    // regra de negócio e mora no CoursePointsPolicy.
    @Query("""
            select c.cooperativeMember.id as cooperativeMemberId,
                   c.totalMinutes as totalMinutes
            from Course c
            where c.completionDate between :start and :end
            """)
    List<MemberCourseMinutes> findMemberMinutesByCompletionDateBetween(@Param("start") LocalDate start,
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
