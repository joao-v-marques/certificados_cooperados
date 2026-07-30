package com.joao_v_marques.certificados_cooperados.repository;

import com.joao_v_marques.certificados_cooperados.entity.CooperativeMember;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CooperativeMemberRepository extends JpaRepository<CooperativeMember, Integer> {

    // As duas colunas são UNIQUE no banco; consultar antes evita que a violação
    // da constraint suba como erro genérico em vez de mensagem de negócio.
    boolean existsByNameIgnoreCase(String name);

    boolean existsByEmailIgnoreCase(String email);
}
