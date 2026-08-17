package com.joao_v_marques.certificados_cooperados.controller;

import com.joao_v_marques.certificados_cooperados.dto.SatisfactionSurveyRequest;
import com.joao_v_marques.certificados_cooperados.dto.SatisfactionSurveyResponse;
import com.joao_v_marques.certificados_cooperados.security.UserPrincipal;
import com.joao_v_marques.certificados_cooperados.service.SatisfactionSurveyService;
import jakarta.validation.Valid;
import org.apache.coyote.Response;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/satisfaction-survey")
public class SatisfactionSurveyController {

    private final SatisfactionSurveyService satisfactionSurveyService;

    public SatisfactionSurveyController(SatisfactionSurveyService satisfactionSurveyService) {
        this.satisfactionSurveyService = satisfactionSurveyService;
    }

    // GET de todas as pesquisas de satisfação cadastradas ordenado pelo ano ASC
    @GetMapping
    public List<SatisfactionSurveyResponse> findAllOrderByYearAsc() {
        return satisfactionSurveyService.findAllOrderByYearAsc();
    }

    // POST de uma nova pesquisa de satisfação
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<SatisfactionSurveyResponse> create(@Valid @RequestBody SatisfactionSurveyRequest request, @AuthenticationPrincipal UserPrincipal currentUser) {
        Integer currentUserId = currentUser.getId();

        SatisfactionSurveyResponse savedSatisfactionSurvey = satisfactionSurveyService.create(request, currentUserId);

        URI location = URI.create("/api/v1/occurrences/" + savedSatisfactionSurvey.id());

        return ResponseEntity.created(location).body(savedSatisfactionSurvey);
    }
}
