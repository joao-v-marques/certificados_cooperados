package com.joao_v_marques.certificados_cooperados.repository;

import com.joao_v_marques.certificados_cooperados.entity.CooperativeMember;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CooperativeMemberRepository extends JpaRepository<CooperativeMember, Integer> {
}
