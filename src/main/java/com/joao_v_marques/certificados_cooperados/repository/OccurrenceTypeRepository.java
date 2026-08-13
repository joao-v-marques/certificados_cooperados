package com.joao_v_marques.certificados_cooperados.repository;

import com.joao_v_marques.certificados_cooperados.entity.OccurrenceType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface OccurrenceTypeRepository extends JpaRepository<OccurrenceType, Integer> {

    @Query("select t from OccurrenceType t where t.isActive = true order by t.name asc")
    List<OccurrenceType> findActiveOrderByName();
}
