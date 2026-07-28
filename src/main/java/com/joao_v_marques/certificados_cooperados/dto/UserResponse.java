package com.joao_v_marques.certificados_cooperados.dto;

import java.time.OffsetDateTime;

public record UserResponse(Integer id, String username, String name, String email, OffsetDateTime createdAt, String roleName, boolean isActive) {
}
