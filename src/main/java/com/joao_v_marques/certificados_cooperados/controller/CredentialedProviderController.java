package com.joao_v_marques.certificados_cooperados.controller;

import com.joao_v_marques.certificados_cooperados.dto.CredentialedProviderRequest;
import com.joao_v_marques.certificados_cooperados.dto.CredentialedProviderResponse;
import com.joao_v_marques.certificados_cooperados.service.CredentialedProviderService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/credentialed-providers")
public class CredentialedProviderController {

    private final CredentialedProviderService service;

    public CredentialedProviderController(CredentialedProviderService service) {
        this.service = service;
    }

    // GET de todos credenciados cadastrados
    @GetMapping
    public List<CredentialedProviderResponse> findAll() {
        return service.findAll();
    }

    // POST de um novo credenciado
    @PostMapping
    public ResponseEntity<CredentialedProviderResponse> create(@Valid @RequestBody CredentialedProviderRequest request) {
        CredentialedProviderResponse created = service.create(request);

        URI location = URI.create("/api/v1/credentialed-providers/" + created.id());

        return ResponseEntity.created(location).body(created);
    }

    // PUT de um credenciado
    @PutMapping("/{id}")
    public ResponseEntity<CredentialedProviderResponse> update(@PathVariable Integer id, @Valid @RequestBody CredentialedProviderRequest request) {
        CredentialedProviderResponse updated = service.update(id, request);

        return ResponseEntity.ok().body(updated);
    }

    // PATCH para desativar um credenciado, a própria rota define a ação e não precisa de body
    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<CredentialedProviderResponse> deactivate(@PathVariable Integer id) {
        CredentialedProviderResponse deactivated = service.deactivate(id);

        return ResponseEntity.ok().body(deactivated);
    }

    // PATCH para reativar um credenciado
    @PatchMapping("/{id}/reactivate")
    public ResponseEntity<CredentialedProviderResponse> reactivate(@PathVariable Integer id) {
        CredentialedProviderResponse reactivated = service.reactivate(id);

        return ResponseEntity.ok().body(reactivated);
    }
}
