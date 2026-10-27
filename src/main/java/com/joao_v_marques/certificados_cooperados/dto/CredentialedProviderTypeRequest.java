package com.joao_v_marques.certificados_cooperados.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CredentialedProviderTypeRequest(

        @NotBlank(message = "Informe o nome do tipo de credenciado")
        @Size(max = 100, message = "O nome deve ter no máximo 100 caracteres")
        String name
) {}
