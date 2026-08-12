package com.joao_v_marques.certificados_cooperados.repository;

import com.joao_v_marques.certificados_cooperados.entity.Occurrence;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public interface OccurrenceRepository extends JpaRepository<Occurrence, Integer> {

    /**
     * Uma linha da listagem de ocorrências.
     *
     * Traz o nome do tipo e o do cooperado já resolvidos porque é o que a tabela
     * mostra; sem isso cada linha dispararia uma consulta a mais para percorrer
     * as associações LAZY.
     *
     * O usuário que lançou volta em dois campos, e não como um nome pronto: o
     * fallback de name para username é a mesma regra que CourseService aplica no
     * toResponse, e ela mora no service, não na consulta.
     */
    interface OccurrenceDetail {
        Integer getId();

        LocalDate getOccurrenceDate();

        String getObservations();

        OffsetDateTime getCreatedAt();

        String getTypeName();

        Integer getCooperativeMemberId();

        String getCooperativeMemberName();

        String getInsertedByName();

        String getInsertedByUsername();
    }

    /**
     * Todas as ocorrências lançadas, da mais recente para a mais antiga.
     *
     * Os três joins são inner porque as FKs são NOT NULL no schema — ao
     * contrário do certificado em CourseRepository, que é opcional e por isso
     * precisa de left join.
     *
     * O desempate por id garante ordem estável quando duas ocorrências caem no
     * mesmo dia: sem ele, o banco pode devolver as duas em ordem diferente a
     * cada consulta, e a lista "pularia" entre recarregamentos da tela.
     */
    @Query("""
            select o.id as id,
                   o.occurrenceDate as occurrenceDate,
                   o.observations as observations,
                   o.createdAt as createdAt,
                   t.name as typeName,
                   m.id as cooperativeMemberId,
                   m.name as cooperativeMemberName,
                   u.name as insertedByName,
                   u.username as insertedByUsername
            from Occurrence o
            join o.occurrenceType t
            join o.cooperativeMember m
            join o.insertedBy u
            order by o.occurrenceDate desc, o.id desc
            """)
    List<OccurrenceDetail> findAllDetails();
}
