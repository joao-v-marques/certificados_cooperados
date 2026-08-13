package com.joao_v_marques.certificados_cooperados.controller;

import com.joao_v_marques.certificados_cooperados.dto.OccurrenceRequest;
import com.joao_v_marques.certificados_cooperados.dto.OccurrenceTypeRequest;
import com.joao_v_marques.certificados_cooperados.dto.OccurrenceTypeResponse;
import com.joao_v_marques.certificados_cooperados.service.OccurrenceTypeService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/occurrence-types")
public class OccurrenceTypeController {

    private final OccurrenceTypeService occurrenceTypeService;

    public OccurrenceTypeController(OccurrenceTypeService occurrenceTypeService) {
        this.occurrenceTypeService = occurrenceTypeService;
    }

    // GET de todos os tipos de ocorrência cadastrados no sistema
    @GetMapping("/all")
    public List<OccurrenceTypeResponse> finAll() {
        return occurrenceTypeService.findAll();
    }

    // GET de todos os tipos de ocorrência cadastrados como ATIVO
    @GetMapping
    public List<OccurrenceTypeResponse> findAllActive() {
        return occurrenceTypeService.findAllActiveTypes();
    }

    // POST de um novo tipo de ocorrência
    @PostMapping
    public ResponseEntity<OccurrenceTypeResponse> create(@Valid @RequestBody OccurrenceTypeRequest request) {
        OccurrenceTypeResponse createdOccurrenceType = occurrenceTypeService.create(request);

        URI location = URI.create("/api/v1/occurrences-types/" + createdOccurrenceType.id());

        return ResponseEntity.created(location).body(createdOccurrenceType);
    }
}
