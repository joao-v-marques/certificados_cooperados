package com.joao_v_marques.certificados_cooperados.dto;

import jakarta.validation.constraints.NotNull;

public record OccurrenceTypeDelete(

        @NotNull(message = "Informe se o tipo de ocorrência será ativo ou inativo")
        Boolean isActive
) {}
