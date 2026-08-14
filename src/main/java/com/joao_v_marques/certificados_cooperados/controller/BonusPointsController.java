package com.joao_v_marques.certificados_cooperados.controller;

import com.joao_v_marques.certificados_cooperados.dto.BonusPointsReportResponse;
import com.joao_v_marques.certificados_cooperados.service.BonusPointsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Year;

@RestController
@RequestMapping("/api/v1/bonus-points")
public class BonusPointsController {

    private final BonusPointsService bonusPointsService;

    public BonusPointsController(BonusPointsService bonusPointsService) {
        this.bonusPointsService = bonusPointsService;
    }

    // A matriz do ano vem numa resposta só: KPI, colunas e linhas juntos, para a tela não
    // conseguir mostrar cabeçalho de um ano e linhas de outro
    @GetMapping("/report")
    public BonusPointsReportResponse findReport(@RequestParam(required = false) Integer year) {

        int baseYear = (year != null) ? year : Year.now().getValue();

        return bonusPointsService.findReport(baseYear);
    }
}
