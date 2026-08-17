package com.joao_v_marques.certificados_cooperados.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record SatisfactionSurveyResponse(
        Integer id,
        int surveyYear,
        int totalMembers,
        int respondents,
        BigDecimal satisfactionIndex,
        int notReached,
        BigDecimal responseRate,
        String insertedByName,
        OffsetDateTime createdAt
) {
}
