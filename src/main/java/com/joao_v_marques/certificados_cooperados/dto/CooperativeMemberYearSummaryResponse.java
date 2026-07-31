package com.joao_v_marques.certificados_cooperados.dto;

/**
 * Uma linha da tabela do painel: o cooperado e o que ele acumulou no ano-base.
 * `totalCourses` e `totalPoints` vêm zerados quando não houve lançamento no ano.
 */
public record CooperativeMemberYearSummaryResponse(
        Integer id,
        String name,
        String email,
        int totalCourses,
        int totalPoints,
        boolean goalReached
) {
}
