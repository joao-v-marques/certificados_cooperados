package com.joao_v_marques.certificados_cooperados.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;

public record SatisfactionSurveyRequest(

        @NotNull(message = "Informe o ano da pesquisa de satisfação.")
        @Positive(message = "O ano da pesquisa precisa ser maior que zero.")
        Integer surveyYear,

        @NotNull(message = "Informe a quantidade total de Cooperados no ano da pesquisa.")
        @Positive(message = "A quantidade de Cooperados deve ser maior que zero.")
        Integer totalMembers,

        @NotNull(message = "Informe a quantidade de Cooperados que responderam a pesquisa de satisfação.")
        @PositiveOrZero(message = "A quantidade de Cooperados que responderam a pesquisa de satisfação não pode ser menor que zero.")
        Integer respondents,

        @NotNull(message = "Informe o índice de satisfação da pesquisa.")
        @DecimalMin(value = "0.00", message = "O índice de satisfação não pode ser menor que 0%.")
        @DecimalMax(value = "100.00", message = "O índice de satisfação não pode ser maior que 100%.")
        @Digits(integer = 3, fraction = 2, message = "O índice de satisfação aceita no máximo duas casas decimais.")
        BigDecimal satisfactionIndex
) {
}
