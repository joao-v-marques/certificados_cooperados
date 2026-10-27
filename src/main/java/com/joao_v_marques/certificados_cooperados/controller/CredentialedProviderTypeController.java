package com.joao_v_marques.certificados_cooperados.controller;

import com.joao_v_marques.certificados_cooperados.dto.CredentialedProviderTypeResponse;
import com.joao_v_marques.certificados_cooperados.service.CredentialedProviderTypeService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
}
