package com.joao_v_marques.certificados_cooperados.dto;

import java.time.OffsetDateTime;

public record CredentialedProviderResponse(
        Integer id,
        String name,
        String email,
        Integer typeId,
        String typeName,
        OffsetDateTime createdAt,
        boolean isActive
) {
}
