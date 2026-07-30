package com.joao_v_marques.certificados_cooperados.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CooperativeMemberRequest(

        @NotBlank(message = "Informe o nome do cooperado")
        @Size(max = 255, message = "O nome deve ter no máximo 255 caracteres")
        String name,

        // Campo opcional: vazio passa na validação e o service transforma em null
        @Email(message = "Informe um email válido")
        @Size(max = 255, message = "O email deve ter no máximo 255 caracteres")
        String email
)  {}
