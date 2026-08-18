package com.joao_v_marques.certificados_cooperados.dto;

import java.util.List;

// Resumo por faixa do ano-base: quantos cooperados em cada uma, sem as linhas individuais
// da matriz de bonus-points/report — pensado para consumo externo (ex.: dashboard_esg).
public record PointsBandsReportResponse(
        int year,
        int totalMembers,
        List<Integer> availableYears,
        List<PointsBandCountResponse> bands
) {}
