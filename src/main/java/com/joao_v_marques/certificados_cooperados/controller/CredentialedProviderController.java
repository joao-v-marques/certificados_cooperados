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
}
