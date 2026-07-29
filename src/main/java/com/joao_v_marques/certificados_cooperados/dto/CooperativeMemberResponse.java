package com.joao_v_marques.certificados_cooperados.dto;

import java.time.OffsetDateTime;

public record CooperativeMemberResponse(Integer id, String name, String email, OffsetDateTime createdAt, boolean isActive) {
}
