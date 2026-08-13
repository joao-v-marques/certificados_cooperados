package com.joao_v_marques.certificados_cooperados.repository;

import com.joao_v_marques.certificados_cooperados.entity.Occurrence;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public interface OccurrenceRepository extends JpaRepository<Occurrence, Integer> {

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
