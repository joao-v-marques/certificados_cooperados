package com.joao_v_marques.certificados_cooperados.repository;

import com.joao_v_marques.certificados_cooperados.entity.OccurrenceType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface OccurrenceTypeRepository extends JpaRepository<OccurrenceType, Integer> {

    boolean existsByNameIgnoreCase(String name);

    @Query("select t from OccurrenceType t order by t.name asc")
    List<OccurrenceType> findAllOrderByName();

    boolean existsByNameIgnoreCaseAndIdNot(String name, Integer id);

    @Query("select t from OccurrenceType t where t.isActive = true order by t.name asc")
    List<OccurrenceType> findActiveOrderByName();
}
