package com.joao_v_marques.certificados_cooperados.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;

// Dto de entrada para POST e PUT de eventos da pontuação premiada
public record BonusEventRequest(

        @NotBlank(message = "Informe o nome do evento.")
        @Size(max = 150, message = "O nome deve ter no máximo 150 caracteres.")
        String name,

        // O formato fica preso em ISO (yyyy-MM-dd), que é o que <input type="date"> envia
        @NotNull(message = "Informe a data do evento.")
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        LocalDate eventDate,

        @NotNull(message = "Informe a pontuação do evento.")
        @Positive(message = "A pontuação precisa ser maior que zero.")
        Integer points
) {}
