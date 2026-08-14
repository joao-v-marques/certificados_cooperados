package com.joao_v_marques.certificados_cooperados.dto;

// Legenda das faixas. Vai na resposta para a tela não repetir os limites que já vivem
// na PointsBandPolicy: mudando a policy, a legenda acompanha sozinha.
public record PointsBandResponse(
        int band,
        int lowerBoundPercent,
        int upperBoundPercent
) {}
