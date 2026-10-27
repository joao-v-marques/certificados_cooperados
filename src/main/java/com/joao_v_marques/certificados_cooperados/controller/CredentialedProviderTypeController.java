package com.joao_v_marques.certificados_cooperados.controller;

import com.joao_v_marques.certificados_cooperados.dto.CredentialedProviderTypeRequest;
import com.joao_v_marques.certificados_cooperados.dto.CredentialedProviderTypeResponse;
import com.joao_v_marques.certificados_cooperados.service.CredentialedProviderTypeService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/credentialed-provider-types")
public class CredentialedProviderTypeController {

    private final CredentialedProviderTypeService service;

    public CredentialedProviderTypeController(CredentialedProviderTypeService service) {
        this.service = service;
    }

    // GET de todos os tipos cadastrados no sistema
    @GetMapping
    public List<CredentialedProviderTypeResponse> findAll() {
        return service.findAll();
    }

    // POST de um novo tipo de credenciado
    @PostMapping
    public ResponseEntity<CredentialedProviderTypeResponse> create(@Valid @RequestBody CredentialedProviderTypeRequest request) {
        CredentialedProviderTypeResponse created = service.create(request);

        URI location = URI.create("/api/v1/credentialed-provider-types/" + created.id());

        return ResponseEntity.created(location).body(created);
    }

    // PUT de um tipo de credenciado
    @PutMapping("/{id}")
    public ResponseEntity<CredentialedProviderTypeResponse> update(@PathVariable Integer id, @Valid @RequestBody CredentialedProviderTypeRequest request) {
        CredentialedProviderTypeResponse updated = service.update(id, request);

        return ResponseEntity.ok().body(updated);
    }

    // PATCH para desativar um tipo de credenciado, a própria rota define a ação e não precisa de body
    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<CredentialedProviderTypeResponse> deactivate(@PathVariable Integer id) {
        CredentialedProviderTypeResponse deactivated = service.deactivate(id);

        return ResponseEntity.ok().body(deactivated);
    }

    // PATCH para reativar um tipo de credenciado
    @PatchMapping("/{id}/reactivate")
    public ResponseEntity<CredentialedProviderTypeResponse> reactivate(@PathVariable Integer id) {
        CredentialedProviderTypeResponse reactivated = service.reactivate(id);

        return ResponseEntity.ok().body(reactivated);
    }
}
