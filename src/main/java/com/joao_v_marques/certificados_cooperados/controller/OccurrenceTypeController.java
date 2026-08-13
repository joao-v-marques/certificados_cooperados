package com.joao_v_marques.certificados_cooperados.controller;

import com.joao_v_marques.certificados_cooperados.dto.OccurrenceTypeResponse;
import com.joao_v_marques.certificados_cooperados.service.OccurrenceTypeService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/occurrence-types")
public class OccurrenceTypeController {

    private final OccurrenceTypeService occurrenceTypeService;

    public OccurrenceTypeController(OccurrenceTypeService occurrenceTypeService) {
        this.occurrenceTypeService = occurrenceTypeService;
    }

    // GET de todos os tipos de ocorrência cadastrados como ATIVO
    @GetMapping
    public List<OccurrenceTypeResponse> findAllActive() {
        return occurrenceTypeService.findAllActiveTypes();
    }
}
