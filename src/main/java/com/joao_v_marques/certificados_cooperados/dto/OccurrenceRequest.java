package com.joao_v_marques.certificados_cooperados.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

// Dto para realizar o POST das ocorrências (ADICIONADO NOTAÇÕES DE BEAN VALIDATION)
public record OccurrenceRequest(

        @NotNull(message = "Informe o tipo da ocorrência.")
        Integer occurrenceTypeId,

        @NotNull(message = "Informe o cooperado que solicitou a ocorrência.")
        Integer cooperativeMemberId,

        @NotNull(message = "Informe a data da ocorrência.")
        @PastOrPresent(message = "A data da ocorrência não pode ser futura.")
        LocalDate occurrenceDate,

        @NotBlank(message = "Descreva a ocorrência nas observações.")
        @Size(max = 2000, message = "As observações devem ter no máximo 2000 caracteres.")
        String observations
) {}
