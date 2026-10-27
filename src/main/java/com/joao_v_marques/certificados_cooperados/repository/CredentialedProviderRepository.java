package com.joao_v_marques.certificados_cooperados.repository;

import com.joao_v_marques.certificados_cooperados.entity.CredentialedProvider;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface CredentialedProviderRepository extends JpaRepository<CredentialedProvider, Integer> {

    // JOIN FETCH traz o tipo na mesma query e evita um SELECT por credenciado ao montar o response
    @Query("select p from CredentialedProvider p join fetch p.credentialedProviderType order by p.name asc")
    List<CredentialedProvider> findAllWithFk();
}
