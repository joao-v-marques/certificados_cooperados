package com.joao_v_marques.certificados_cooperados.repository;

import com.joao_v_marques.certificados_cooperados.entity.CooperativeMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface CooperativeMemberRepository extends JpaRepository<CooperativeMember, Integer> {

    boolean existsByNameIgnoreCase(String name);

    boolean existsByEmailIgnoreCase(String email);

    @Query("select m from CooperativeMember m where m.isActive = true order by m.name asc")
    List<CooperativeMember> findActiveOrderByName();
}
