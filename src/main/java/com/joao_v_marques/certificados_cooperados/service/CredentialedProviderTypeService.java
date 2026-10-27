package com.joao_v_marques.certificados_cooperados.service;

import com.joao_v_marques.certificados_cooperados.dto.CredentialedProviderTypeResponse;
import com.joao_v_marques.certificados_cooperados.entity.CredentialedProviderType;
import com.joao_v_marques.certificados_cooperados.repository.CredentialedProviderTypeRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CredentialedProviderTypeService {

    private final CredentialedProviderTypeRepository repository;

    public CredentialedProviderTypeService(CredentialedProviderTypeRepository repository) {
        this.repository = repository;
    }

    // GET de todos os tipos cadastrados
    @Transactional(readOnly = true)
    public List<CredentialedProviderTypeResponse> findAll() {
        return repository.findAll(Sort.by("name"))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private CredentialedProviderTypeResponse toResponse(CredentialedProviderType type) {
        return new CredentialedProviderTypeResponse(
                type.getId(),
                type.getName(),
                type.isActive()
        );
    }
}
