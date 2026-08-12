package com.joao_v_marques.certificados_cooperados.controller;

import com.joao_v_marques.certificados_cooperados.dto.OccurrenceTypeResponse;
import com.joao_v_marques.certificados_cooperados.service.OccurrenceService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Os tipos de ocorrência são um recurso próprio na URL porque a tela os consulta
 * sozinhos, para montar o select antes de existir qualquer lançamento.
 *
 * O service é o de ocorrências, e não um OccurrenceTypeService: os tipos são
 * vocabulário semeado por migration, sem cadastro nem regra própria — um service
 * separado seria só um repasse. É o mesmo arranjo de CooperativeMemberController,
 * que também não tem um service por endpoint.
 */
@RestController
@RequestMapping("/api/v1/occurrence-types")
public class OccurrenceTypeController {

    private final OccurrenceService occurrenceService;

    public OccurrenceTypeController(OccurrenceService occurrenceService) {
        this.occurrenceService = occurrenceService;
    }

    // Só os ativos: é o que o select pode oferecer sem propor uma opção que o
    // POST de ocorrência recusaria.
    @GetMapping
    public List<OccurrenceTypeResponse> findAllActive() {
        return occurrenceService.findAllActiveTypes();
    }
}
