package com.joao_v_marques.certificados_cooperados.service;

import com.joao_v_marques.certificados_cooperados.dto.OccurrenceRequest;
import com.joao_v_marques.certificados_cooperados.dto.OccurrenceTypeRequest;
import com.joao_v_marques.certificados_cooperados.dto.OccurrenceTypeResponse;
import com.joao_v_marques.certificados_cooperados.entity.Occurrence;
import com.joao_v_marques.certificados_cooperados.entity.OccurrenceType;
import com.joao_v_marques.certificados_cooperados.repository.OccurrenceTypeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class OccurrenceTypeService {

    private final OccurrenceTypeRepository occurrenceTypeRepository;

    public OccurrenceTypeService(OccurrenceTypeRepository occurrenceTypeRepository) {
        this.occurrenceTypeRepository = occurrenceTypeRepository;
    }

    // GET de todos os tipos cadastrados no sistema
    @Transactional(readOnly = true)
    public List<OccurrenceTypeResponse> findAll() {
        return occurrenceTypeRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    // GET de todos os tipos ativos cadastrados no sistema
    @Transactional(readOnly = true)
    public List<OccurrenceTypeResponse> findAllActiveTypes() {
        return occurrenceTypeRepository.findActiveOrderByName()
                .stream()
                .map(type -> new OccurrenceTypeResponse(type.getId(), type.getName()))
                .toList();
    }

    // POST de um novo tipo de ocorrência
    @Transactional
    public OccurrenceTypeResponse create(OccurrenceTypeRequest request) {

        // Montar entidade, DTO nunca vira entidade sozinho
        OccurrenceType occurrenceType = new OccurrenceType();
        occurrenceType.setName(request.name().trim());

        OccurrenceType savedOccurrenceType = occurrenceTypeRepository.save(occurrenceType);

        return toResponse(savedOccurrenceType);
    }

    @Transactional
    public void delete(Integer id) {
        OccurrenceType occurrenceType = occurrenceTypeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("O tipo de ocorrência com esse ID não existe."));

        occurrenceTypeRepository.delete(occurrenceType);
    }

    private OccurrenceTypeResponse toResponse(OccurrenceType occurrenceType) {
        return new OccurrenceTypeResponse(
            occurrenceType.getId(),
            occurrenceType.getName()
        );
    }
}
