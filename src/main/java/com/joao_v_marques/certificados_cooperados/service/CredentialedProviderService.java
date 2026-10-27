package com.joao_v_marques.certificados_cooperados.service;

import com.joao_v_marques.certificados_cooperados.dto.CredentialedProviderRequest;
import com.joao_v_marques.certificados_cooperados.dto.CredentialedProviderResponse;
import com.joao_v_marques.certificados_cooperados.entity.CredentialedProvider;
import com.joao_v_marques.certificados_cooperados.entity.CredentialedProviderType;
import com.joao_v_marques.certificados_cooperados.repository.CredentialedProviderRepository;
import com.joao_v_marques.certificados_cooperados.repository.CredentialedProviderTypeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
public class CredentialedProviderService {

    private final CredentialedProviderRepository repository;
    private final CredentialedProviderTypeRepository typeRepository;

    public CredentialedProviderService(CredentialedProviderRepository repository,
                                       CredentialedProviderTypeRepository typeRepository) {
        this.repository = repository;
        this.typeRepository = typeRepository;
    }

    // GET de todos credenciados cadastrados
    @Transactional(readOnly = true)
    public List<CredentialedProviderResponse> findAll() {
        return repository.findAllWithFk()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    // POST de um novo credenciado
    @Transactional
    public CredentialedProviderResponse create(CredentialedProviderRequest request) {

        String email = StringUtils.hasText(request.email()) ? request.email().trim() : null;

        // Já valida se a FK passada existe, caso não exista já retorna erro
        CredentialedProviderType type = typeRepository.findById(request.typeId())
                .orElseThrow(() -> new IllegalArgumentException("Tipo de credenciado não encontrado."));

        // Validações e regras que a DTO não está cobrindo
        if (!type.isActive()) {
            throw new IllegalArgumentException("Este tipo de credenciado está desativado.");
        }

        // Montar entidade, DTO nunca vira entidade sozinho
        CredentialedProvider credentialed = new CredentialedProvider();
        credentialed.setName(request.name().trim());
        credentialed.setEmail(email);
        credentialed.setCredentialedProviderType(type);

        CredentialedProvider saved = repository.save(credentialed);

        return toResponse(saved);
    }

    // PUT de um credenciado já existente
    @Transactional
    public CredentialedProviderResponse update(Integer id, CredentialedProviderRequest request) {

        // Validar se o credenciado editado realmente existe
        CredentialedProvider credentialed = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("O credenciado que tentou editar não existe."));

        String email = StringUtils.hasText(request.email()) ? request.email().trim() : null;

        // Já valida se a FK passada existe, caso não exista já retorna erro
        CredentialedProviderType type = typeRepository.findById(request.typeId())
                .orElseThrow(() -> new IllegalArgumentException("Tipo de credenciado não encontrado."));

        // Validações e regras que a DTO não está cobrindo
        if (!type.isActive()) {
            throw new IllegalArgumentException("O tipo de credenciado selecionado não está ativo.");
        }

        // Atualizando entidade já existente
        credentialed.setName(request.name().trim());
        credentialed.setEmail(email);
        credentialed.setCredentialedProviderType(type);

        return toResponse(credentialed);
    }

    // PATCH para desativar um credenciado (soft delete)
    @Transactional
    public CredentialedProviderResponse deactivate(Integer id) {

        CredentialedProvider credentialed = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("O credenciado com esse ID não existe."));

        credentialed.setActive(false);

        return toResponse(credentialed);
    }

    // PATCH para reativar um credenciado
    @Transactional
    public CredentialedProviderResponse reactivate(Integer id) {

        CredentialedProvider credentialed = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("O credenciado com esse ID não existe."));

        credentialed.setActive(true);

        return toResponse(credentialed);
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
