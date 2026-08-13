package com.joao_v_marques.certificados_cooperados.service;

import com.joao_v_marques.certificados_cooperados.dto.OccurrenceRequest;
import com.joao_v_marques.certificados_cooperados.dto.OccurrenceResponse;
import com.joao_v_marques.certificados_cooperados.dto.OccurrenceTypeResponse;
import com.joao_v_marques.certificados_cooperados.entity.CooperativeMember;
import com.joao_v_marques.certificados_cooperados.entity.Occurrence;
import com.joao_v_marques.certificados_cooperados.entity.OccurrenceType;
import com.joao_v_marques.certificados_cooperados.entity.User;
import com.joao_v_marques.certificados_cooperados.repository.CooperativeMemberRepository;
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
    private final UserRepository userRepository;

    public OccurrenceService(OccurrenceRepository occurrenceRepository,
                             OccurrenceTypeRepository occurrenceTypeRepository,
                             CooperativeMemberRepository cooperativeMemberRepository,
                             UserRepository userRepository) {
        this.occurrenceRepository = occurrenceRepository;
        this.occurrenceTypeRepository = occurrenceTypeRepository;
        this.cooperativeMemberRepository = cooperativeMemberRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<OccurrenceTypeResponse> findAllActiveTypes() {
        return occurrenceTypeRepository.findActiveOrderByName()
                .stream()
                .map(type -> new OccurrenceTypeResponse(type.getId(), type.getName()))
                .toList();
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
        CooperativeMember cooperativeMember = cooperativeMemberRepository.findById(request.cooperativeMemberId())
                .orElseThrow(() -> new IllegalArgumentException("Cooperado não encontrado."));

        User insertedBy = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalStateException("Usuário responsável não encontrado."));

        // regras de negócio que as anotações das dto's não cobrem
        if (!cooperativeMember.isActive()) {
            throw new IllegalArgumentException("Este cooperado está inativo.");
        }
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
        occurrence.setCooperativeMember(cooperativeMember);
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
        CooperativeMember cooperativeMember = cooperativeMemberRepository.findById(request.cooperativeMemberId())
                .orElseThrow(() -> new IllegalArgumentException("O Cooperado inserido não foi encontrado."));

        // Validações e regras que as DTO's não estão cobrindo
        if (!occurrenceType.isActive()) {
            throw new IllegalArgumentException("O tipo de ocorrência selecionado não está ativo.");
        }
        if (!cooperativeMember.isActive()) {
            throw new IllegalArgumentException("O Cooperado selecionado não está mais ativo.");
        }

        // Atualizando entidade já existente
        occurrence.setOccurrenceDate(request.occurrenceDate());
        occurrence.setObservations(request.observations().trim());
        occurrence.setOccurrenceType(occurrenceType);
        occurrence.setCooperativeMember(cooperativeMember);

        return toResponse(occurrence);
    }

    @Transactional
    public void delete(Integer id) {
        // Valida se a ocorrência realmente existe, antes de tentar deletar
        Occurrence occurrence = occurrenceRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("A Ocorrência que tentou excluir não existe."));

        occurrenceRepository.delete(occurrence);
    }

    private OccurrenceResponse toResponse(Occurrence occurrence) {
        return new OccurrenceResponse(
                occurrence.getId(),
                occurrence.getOccurrenceDate(),
                occurrence.getObservations(),
                occurrence.getCreatedAt(),
                occurrence.getOccurrenceType().getName(),
                occurrence.getCooperativeMember().getId(),
                occurrence.getCooperativeMember().getName(),
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
                displayNameOf(detail.getInsertedByName(), detail.getInsertedByUsername())
        );
    }

    private String displayNameOf(String name, String username) {
        return name != null ? name : username;
    }
}
