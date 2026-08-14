package com.joao_v_marques.certificados_cooperados.dto;

import java.time.LocalDate;

// Uma coluna da matriz: o evento e quanto ele vale.
public record BonusEventColumnResponse(
        Integer id,
        String name,
        LocalDate eventDate,
        Integer points
) {}
