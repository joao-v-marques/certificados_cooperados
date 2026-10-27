package com.joao_v_marques.certificados_cooperados.service;

import com.joao_v_marques.certificados_cooperados.dto.CredentialedProviderResponse;
import com.joao_v_marques.certificados_cooperados.entity.CredentialedProvider;
import com.joao_v_marques.certificados_cooperados.repository.CredentialedProviderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CredentialedProviderService {

    private final CredentialedProviderRepository repository;

    public CredentialedProviderService(CredentialedProviderRepository repository) {
        this.repository = repository;
    }

    // GET de todos credenciados cadastrados
    @Transactional(readOnly = true)
    public List<CredentialedProviderResponse> findAll() {
        return repository.findAllWithFk()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private CredentialedProviderResponse toResponse(CredentialedProvider credentialed) {
        return new CredentialedProviderResponse(
                credentialed.getId(),
                credentialed.getName(),
                credentialed.getEmail(),
                credentialed.getCredentialedProviderType().getId(),
                credentialed.getCredentialedProviderType().getName(),
                credentialed.getCreatedAt(),
                credentialed.isActive()
        );
    }
}
