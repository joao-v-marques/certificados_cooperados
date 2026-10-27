package com.joao_v_marques.certificados_cooperados.repository;

import com.joao_v_marques.certificados_cooperados.entity.CredentialedProviderType;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CredentialedProviderTypeRepository extends JpaRepository<CredentialedProviderType, Integer> {

    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, Integer id);
}
