package com.joao_v_marques.certificados_cooperados.dto;

import java.util.List;

// Resposta única da matriz de pontuação premiada: colunas, linhas, legenda e os anos que o
// select pode oferecer.
//
// Vem tudo junto de propósito, mesmo motivo já documentado em
// CooperativeMembersYearReportResponse: separar em outra chamada criaria a chance de a tela
// mostrar cabeçalho de um ano e linhas de outro.
public record BonusPointsReportResponse(
        int year,
        int totalEventPoints,   // soma dos eventos ativos do ano
        int annualGoalPoints,   // a meta de cursos que entra no denominador
        int maxPossiblePoints,  // totalEventPoints + annualGoalPoints
        int totalMembers,
        List<Integer> availableYears,
        List<PointsBandResponse> bands,
        List<BonusEventColumnResponse> events,
        List<MemberBonusPointsResponse> members
) {}
