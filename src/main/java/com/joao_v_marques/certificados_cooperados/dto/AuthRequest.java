package com.joao_v_marques.certificados_cooperados.dto;

import jakarta.validation.constraints.NotBlank;

public record AuthRequest(

        @NotBlank(message = "Informe o usuário.")
        String username,

        @NotBlank(message = "Informe a senha.")
        String password
) {
}
