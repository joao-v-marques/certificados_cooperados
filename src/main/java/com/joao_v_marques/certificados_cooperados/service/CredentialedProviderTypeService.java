package com.joao_v_marques.certificados_cooperados.service;

import com.joao_v_marques.certificados_cooperados.dto.CredentialedProviderTypeRequest;
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

    // POST de um novo tipo de credenciado
    @Transactional
    public CredentialedProviderTypeResponse create(CredentialedProviderTypeRequest request) {

        if (repository.existsByNameIgnoreCase(request.name().trim())) {
            throw new IllegalArgumentException("Já existe um tipo de credenciado com esse nome.");
        }

        // Montar entidade, DTO nunca vira entidade sozinho
        CredentialedProviderType type = new CredentialedProviderType();
        type.setName(request.name().trim());

        CredentialedProviderType savedType = repository.save(type);

        return toResponse(savedType);
    }

    // PUT de um tipo de credenciado
    @Transactional
    public CredentialedProviderTypeResponse update(Integer id, CredentialedProviderTypeRequest request) {

        CredentialedProviderType type = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("O tipo de credenciado com esse ID não existe."));

        if (repository.existsByNameIgnoreCaseAndIdNot(request.name().trim(), id)) {
            throw new IllegalArgumentException("Já existe um tipo de credenciado com esse nome.");
        }

        type.setName(request.name().trim());

        return toResponse(type);
    }

    // PATCH para desativar um tipo de credenciado (soft delete)
    @Transactional
    public CredentialedProviderTypeResponse deactivate(Integer id) {

        CredentialedProviderType type = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("O tipo de credenciado com esse ID não existe."));

        type.setActive(false);

        return toResponse(type);
    }

    // PATCH para reativar um tipo de credenciado
    @Transactional
    public CredentialedProviderTypeResponse reactivate(Integer id) {

        CredentialedProviderType type = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("O tipo de credenciado com esse ID não existe."));

        type.setActive(true);

        return toResponse(type);
    }

    private CredentialedProviderTypeResponse toResponse(CredentialedProviderType type) {
        return new CredentialedProviderTypeResponse(
                type.getId(),
                type.getName(),
                type.isActive()
        );
    }
}
