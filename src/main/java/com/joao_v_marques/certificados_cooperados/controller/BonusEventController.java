package com.joao_v_marques.certificados_cooperados.controller;

import com.joao_v_marques.certificados_cooperados.dto.BonusEventParticipationsRequest;
import com.joao_v_marques.certificados_cooperados.dto.BonusEventParticipationsResponse;
import com.joao_v_marques.certificados_cooperados.dto.BonusEventRequest;
import com.joao_v_marques.certificados_cooperados.dto.BonusEventResponse;
import com.joao_v_marques.certificados_cooperados.security.UserPrincipal;
import com.joao_v_marques.certificados_cooperados.service.BonusEventService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.Year;
import java.util.List;

@RestController
@RequestMapping("/api/v1/bonus-events")
public class BonusEventController {

    private final BonusEventService bonusEventService;

    public BonusEventController(BonusEventService bonusEventService) {
        this.bonusEventService = bonusEventService;
    }

    // GET dos eventos do ano, incluindo os desativados. Sem year assume o ano corrente,
    // que é o que a tela abre por padrão
    @GetMapping
    public List<BonusEventResponse> findByYear(@RequestParam(required = false) Integer year) {

        int baseYear = (year != null) ? year : Year.now().getValue();

        return bonusEventService.findByYear(baseYear);
    }

    // POST de um novo evento
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<BonusEventResponse> create(@Valid @RequestBody BonusEventRequest request,
                                                     @AuthenticationPrincipal UserPrincipal currentUser) {
        // quem cadastra é sempre o usuário autenticado; a rota exige login no SecurityConfig
        BonusEventResponse created = bonusEventService.create(request, currentUser.getId());

        URI location = URI.create("/api/v1/bonus-events/" + created.id());

        return ResponseEntity.created(location).body(created);
    }

    // UPDATE de um evento já existente
    @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<BonusEventResponse> update(@PathVariable Integer id,
                                                     @Valid @RequestBody BonusEventRequest request) {

        return ResponseEntity.ok(bonusEventService.update(id, request));
    }

    // DELETE lógico. Devolve o evento já com is_active false, para a tela atualizar a linha
    // sem precisar recarregar a lista inteira
    @DeleteMapping("/{id}")
    public ResponseEntity<BonusEventResponse> delete(@PathVariable Integer id) {

        return ResponseEntity.ok(bonusEventService.delete(id));
    }

    // GET da lista de presença: todos os cooperados que a tela pode marcar, com quem já está
    @GetMapping("/{id}/participations")
    public BonusEventParticipationsResponse findParticipations(@PathVariable Integer id) {

        return bonusEventService.findParticipations(id);
    }

    // PUT da lista inteira, e não um POST por checkbox: o service compara com o banco e
    // resolve o que inserir e apagar numa transação só
    @PutMapping(value = "/{id}/participations", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<BonusEventParticipationsResponse> saveParticipations(
            @PathVariable Integer id,
            @Valid @RequestBody BonusEventParticipationsRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser) {

        return ResponseEntity.ok(bonusEventService.saveParticipations(id, request, currentUser.getId()));
    }
}
