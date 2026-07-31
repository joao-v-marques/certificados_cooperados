package com.joao_v_marques.certificados_cooperados.controller;

import com.joao_v_marques.certificados_cooperados.dto.CooperativeMemberRequest;
import com.joao_v_marques.certificados_cooperados.dto.CooperativeMemberResponse;
import com.joao_v_marques.certificados_cooperados.dto.CooperativeMembersYearReportResponse;
import com.joao_v_marques.certificados_cooperados.service.CooperativeMemberService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.Year;
import java.util.List;

@RestController
@RequestMapping("/api/v1/cooperative-members")
public class CooperativeMemberController {

    private final CooperativeMemberService cooperativeMemberService;

    public CooperativeMemberController(CooperativeMemberService cooperativeMemberService) {
        this.cooperativeMemberService = cooperativeMemberService;
    }

    // Sem `active` devolve todo o cadastro, que é o que a tela de cooperados
    // mostra; com `active=true` devolve só quem pode receber lançamento, que é o
    // que a select de novo curso precisa.
    @GetMapping
    public List<CooperativeMemberResponse> findAll(@RequestParam(required = false) Boolean active) {

        if (Boolean.TRUE.equals(active)) {
            return cooperativeMemberService.findAllActive();
        }

        return cooperativeMemberService.findAll();
    }

    // Relatório do painel de controle. Sem year assume o ano corrente, o que a tela abre por padrão; a conversão do ano em período é regra e fica no service
    @GetMapping("/annual-report")
    public CooperativeMembersYearReportResponse findYearReport(@RequestParam(required = false) Integer year) {

        int baseYear = (year != null) ? year : Year.now().getValue();

        return cooperativeMemberService.findYearReport(baseYear);
    }

    // Cooperado não tem upload, então o corpo é JSON: @RequestBody, e não
    // @ModelAttribute como no lançamento de curso (lá o corpo é multipart)
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<CooperativeMemberResponse> create(@Valid @RequestBody CooperativeMemberRequest request) {

        CooperativeMemberResponse created = cooperativeMemberService.create(request);

        URI location = URI.create("/api/v1/cooperative-members/" + created.id());

        return ResponseEntity.created(location).body(created);
    }
}
