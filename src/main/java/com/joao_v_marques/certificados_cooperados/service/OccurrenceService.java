package com.joao_v_marques.certificados_cooperados.service;

import com.joao_v_marques.certificados_cooperados.dto.OccurrenceRequest;
import com.joao_v_marques.certificados_cooperados.dto.OccurrenceResponse;
import com.joao_v_marques.certificados_cooperados.entity.CooperativeMember;
import com.joao_v_marques.certificados_cooperados.entity.CredentialedProvider;
import com.joao_v_marques.certificados_cooperados.entity.Occurrence;
import com.joao_v_marques.certificados_cooperados.entity.OccurrenceType;
import com.joao_v_marques.certificados_cooperados.entity.User;
import com.joao_v_marques.certificados_cooperados.repository.CooperativeMemberRepository;
import com.joao_v_marques.certificados_cooperados.repository.CredentialedProviderRepository;
import com.joao_v_marques.certificados_cooperados.repository.OccurrenceRepository;
import com.joao_v_marques.certificados_cooperados.repository.OccurrenceTypeRepository;
import com.joao_v_marques.certificados_cooperados.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class OccurrenceService {

    private final OccurrenceRepository occurrenceRepository;
    private final OccurrenceTypeRepository occurrenceTypeRepository;
    private final CooperativeMemberRepository cooperativeMemberRepository;
    private final CredentialedProviderRepository credentialedProviderRepository;
    private final UserRepository userRepository;

    public OccurrenceService(OccurrenceRepository occurrenceRepository,
                             OccurrenceTypeRepository occurrenceTypeRepository,
                             CooperativeMemberRepository cooperativeMemberRepository,
                             CredentialedProviderRepository credentialedProviderRepository,
                             UserRepository userRepository) {
        this.occurrenceRepository = occurrenceRepository;
        this.occurrenceTypeRepository = occurrenceTypeRepository;
        this.cooperativeMemberRepository = cooperativeMemberRepository;
        this.credentialedProviderRepository = credentialedProviderRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<OccurrenceResponse> findAll() {
        return occurrenceRepository.findAllDetails()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public OccurrenceResponse create(OccurrenceRequest request, Integer currentUserId) {

        // resolve as FK's e dá erro se não existir
        OccurrenceType occurrenceType = occurrenceTypeRepository.findById(request.occurrenceTypeId())
                .orElseThrow(() -> new IllegalArgumentException("Tipo de ocorrência não encontrada."));

        User insertedBy = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalStateException("Usuário responsável não encontrado."));

        // regras de negócio que as anotações das dto's não cobrem
        // O tipo desativado nem aparece no select, mas a API continua alcançável
        // por quem monta a requisição na mão.
        if (!occurrenceType.isActive()) {
            throw new IllegalArgumentException("Este tipo de ocorrência está desativado.");
        }

        // montar a entidade, o DTO nunca vira entidade sozinho
        Occurrence occurrence = new Occurrence();
        occurrence.setOccurrenceDate(request.occurrenceDate());
        occurrence.setObservations(request.observations().trim());
        occurrence.setOccurrenceType(occurrenceType);
        applyRequester(occurrence, request);
        occurrence.setInsertedBy(insertedBy);

        Occurrence saved = occurrenceRepository.save(occurrence);

        // transforma a entidade para dto de saída(response) e retorna
        return toResponse(saved);
    }

    // UPDATE de uma ocorrência já existente
    @Transactional
    public OccurrenceResponse update(Integer id, OccurrenceRequest request) {

        // Validar se a Ocorrência editada realmente existe
        Occurrence occurrence = occurrenceRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("A ocorrência que tentou editar não existe."));

        // Já valida se as FK's passadas existem, caso não exista já retorna erro
        OccurrenceType occurrenceType = occurrenceTypeRepository.findById(request.occurrenceTypeId())
                .orElseThrow(() -> new IllegalArgumentException("Tipo de ocorrência não encontrada."));

        // Validações e regras que as DTO's não estão cobrindo
        if (!occurrenceType.isActive()) {
            throw new IllegalArgumentException("O tipo de ocorrência selecionado não está ativo.");
        }

        // Atualizando entidade já existente
        occurrence.setOccurrenceDate(request.occurrenceDate());
        occurrence.setObservations(request.observations().trim());
        occurrence.setOccurrenceType(occurrenceType);
        applyRequester(occurrence, request);

        return toResponse(occurrence);
    }

    @Transactional
    public void delete(Integer id) {
        // Valida se a ocorrência realmente existe, antes de tentar deletar
        Occurrence occurrence = occurrenceRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("A Ocorrência que tentou excluir não existe."));

        occurrenceRepository.delete(occurrence);
    }

    // Preenche o solicitante (cooperado OU credenciado) e zera o outro, o que cobre a troca na edição.
    // O CHECK ck_occurrence_single_requester só é a rede de segurança; daqui sai a mensagem de negócio.
    private void applyRequester(Occurrence occurrence, OccurrenceRequest request) {
        Integer memberId = request.cooperativeMemberId();
        Integer providerId = request.credentialedProviderId();

        if (memberId == null && providerId == null) {
            throw new IllegalArgumentException("Informe o cooperado ou o credenciado que solicitou a ocorrência.");
        }
        if (memberId != null && providerId != null) {
            throw new IllegalArgumentException("Informe apenas um solicitante: cooperado ou credenciado.");
        }

        if (memberId != null) {
            CooperativeMember cooperativeMember = cooperativeMemberRepository.findById(memberId)
                    .orElseThrow(() -> new IllegalArgumentException("Cooperado não encontrado."));
            if (!cooperativeMember.isActive()) {
                throw new IllegalArgumentException("Este cooperado está inativo.");
            }
            occurrence.setCooperativeMember(cooperativeMember);
            occurrence.setCredentialedProvider(null);
        } else {
            CredentialedProvider credentialedProvider = credentialedProviderRepository.findById(providerId)
                    .orElseThrow(() -> new IllegalArgumentException("Credenciado não encontrado."));
            if (!credentialedProvider.isActive()) {
                throw new IllegalArgumentException("Este credenciado está inativo.");
            }
            occurrence.setCredentialedProvider(credentialedProvider);
            occurrence.setCooperativeMember(null);
        }
    }

    private OccurrenceResponse toResponse(Occurrence occurrence) {
        CooperativeMember member = occurrence.getCooperativeMember();
        CredentialedProvider provider = occurrence.getCredentialedProvider();

        return new OccurrenceResponse(
                occurrence.getId(),
                occurrence.getOccurrenceDate(),
                occurrence.getObservations(),
                occurrence.getCreatedAt(),
                occurrence.getOccurrenceType().getName(),
                member != null ? member.getId() : null,
                member != null ? member.getName() : null,
                provider != null ? provider.getId() : null,
                provider != null ? provider.getName() : null,
                displayNameOf(occurrence.getInsertedBy().getName(), occurrence.getInsertedBy().getUsername())
        );
    }

    private OccurrenceResponse toResponse(OccurrenceRepository.OccurrenceDetail detail) {
        return new OccurrenceResponse(
                detail.getId(),
                detail.getOccurrenceDate(),
                detail.getObservations(),
                detail.getCreatedAt(),
                detail.getTypeName(),
                detail.getCooperativeMemberId(),
                detail.getCooperativeMemberName(),
                detail.getCredentialedProviderId(),
                detail.getCredentialedProviderName(),
                displayNameOf(detail.getInsertedByName(), detail.getInsertedByUsername())
        );
    }

    private String displayNameOf(String name, String username) {
        return name != null ? name : username;
    }
}
