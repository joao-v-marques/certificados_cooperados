package com.joao_v_marques.certificados_cooperados.controller;

import com.joao_v_marques.certificados_cooperados.dto.OccurrenceRequest;
import com.joao_v_marques.certificados_cooperados.dto.OccurrenceResponse;
import com.joao_v_marques.certificados_cooperados.security.UserPrincipal;
import com.joao_v_marques.certificados_cooperados.service.OccurrenceService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import javax.print.attribute.standard.Media;
import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/occurrences")
public class OccurrenceController {

    private final OccurrenceService occurrenceService;

    public OccurrenceController(OccurrenceService occurrenceService) {
        this.occurrenceService = occurrenceService;
    }

    // Função de GET, retorna todas as ocorrencias cadastradas no sistema
    @GetMapping
    public List<OccurrenceResponse> findAll() {
        return occurrenceService.findAll();
    }

    // Ocorrência não tem anexo, então o corpo é JSON: @RequestBody, e não
    // @ModelAttribute como no lançamento de curso (lá o corpo é multipart).
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<OccurrenceResponse> create(@Valid @RequestBody OccurrenceRequest request, @AuthenticationPrincipal UserPrincipal currentUser) {
        // quem lança a ocorrência é sempre o usuário autenticado; a rota exige login no SecurityConfig
        Integer currentUserId = currentUser.getId();

        OccurrenceResponse created = occurrenceService.create(request, currentUserId);

        URI location = URI.create("/api/v1/occurrences/" + created.id());

        return ResponseEntity.created(location).body(created);
    }

    // UPDATE de uma ocorrencia já existente
    @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<OccurrenceResponse> update(@PathVariable Integer id, @Valid @RequestBody OccurrenceRequest request) {
        OccurrenceResponse updatedOccurrence = occurrenceService.update(id, request);

        return ResponseEntity.ok(updatedOccurrence);
    }
}
