package com.joao_v_marques.certificados_cooperados.controller;

import com.joao_v_marques.certificados_cooperados.dto.CredentialedProviderResponse;
import com.joao_v_marques.certificados_cooperados.service.CredentialedProviderService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
}
