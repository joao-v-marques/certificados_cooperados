package com.joao_v_marques.certificados_cooperados.dto;

import java.util.List;

/**
 * Resposta única do painel de controle: indicadores do topo, linhas da tabela e
 * os anos que o select de ano-base pode oferecer.
 *
 * Vem tudo junto de propósito — os indicadores são contagens das mesmas linhas,
 * então separar em outra chamada só criaria a chance de a tela mostrar KPI de um
 * ano e tabela de outro.
 */
public record CooperativeMembersYearReportResponse(
        int year,
        int annualGoalPoints,
        int totalMembers,
        int membersWithoutCourses,
        int membersWhoReachedGoal,
        // Contagem, e não percentual pronto: é o mesmo formato dos indicadores
        // vizinhos, e a divisão só faz sentido junto de totalMembers, que já vai
        // no mesmo corpo.
        int membersTrainedInCooperativism,
        List<Integer> availableYears,
        List<CooperativeMemberYearSummaryResponse> members
) {
}
