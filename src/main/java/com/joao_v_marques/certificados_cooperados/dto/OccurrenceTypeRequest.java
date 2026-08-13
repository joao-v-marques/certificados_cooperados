package com.joao_v_marques.certificados_cooperados.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record OccurrenceTypeRequest(

        @NotBlank(message = "Informe o nome do tipo de ocorrência")
        @Size(max = 100, message = "O nome deve ter no máximo 100 caracteres")
        String name
) {}
