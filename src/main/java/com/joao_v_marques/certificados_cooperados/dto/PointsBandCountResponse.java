package com.joao_v_marques.certificados_cooperados.dto;

// Uma linha do resumo por faixa: quantos cooperados caíram nela. O percentual não vem
// pronto daqui — quem consome (ex.: o dashboard_esg) calcula a partir de memberCount e
// totalMembers, mesmo motivo do pct_reciclado em waste_dashboard_service.py.
public record PointsBandCountResponse(
        int band,
        int lowerBoundPercent,
        int upperBoundPercent,
        int memberCount
) {}
