package com.joao_v_marques.certificados_cooperados.service;

import com.joao_v_marques.certificados_cooperados.dto.OccurrenceTypeResponse;
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

    @Transactional(readOnly = true)
    public List<OccurrenceTypeResponse> findAllActiveTypes() {
        return occurrenceTypeRepository.findActiveOrderByName()
                .stream()
                .map(type -> new OccurrenceTypeResponse(type.getId(), type.getName()))
                .toList();
    }
}
