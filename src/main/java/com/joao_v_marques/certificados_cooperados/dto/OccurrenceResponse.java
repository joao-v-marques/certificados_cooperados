package com.joao_v_marques.certificados_cooperados.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record OccurrenceResponse(
        Integer id,
        LocalDate occurrenceDate,
        String observations,
        OffsetDateTime createdAt,
        String occurrenceTypeName,
        Integer cooperativeMemberId,
        String cooperativeMemberName,
        // Só um dos pares cooperado/credenciado vem preenchido; o outro sai null
        Integer credentialedProviderId,
        String credentialedProviderName,
        String insertedByName
) {}
