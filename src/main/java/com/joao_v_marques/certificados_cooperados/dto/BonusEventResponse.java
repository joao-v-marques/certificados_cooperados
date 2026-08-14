package com.joao_v_marques.certificados_cooperados.dto;

import java.time.LocalDate;

public record BonusEventResponse(
        Integer id,
        String name,
        LocalDate eventDate,
        Integer points,
        boolean isActive
) {}
