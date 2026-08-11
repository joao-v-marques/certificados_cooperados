package com.joao_v_marques.certificados_cooperados.dto;

/**
 * Uma linha da tabela do painel: o cooperado e o que ele acumulou no ano-base.
 * `totalCourses` e `totalPoints` vêm zerados quando não houve lançamento no ano.
 *
 * `trainedInCooperativism` é o mesmo critério que alimenta o indicador do topo —
 * ao menos um curso de cooperativismo no ano. Vem por linha para a tabela poder
 * dizer quem está de fora da porcentagem, e não só quantos são.
 */
public record CooperativeMemberYearSummaryResponse(
        Integer id,
        String name,
        String email,
        int totalCourses,
        int totalPoints,
        boolean goalReached,
        boolean trainedInCooperativism
) {
}
