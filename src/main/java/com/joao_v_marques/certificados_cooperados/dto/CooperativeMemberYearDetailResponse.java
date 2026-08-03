package com.joao_v_marques.certificados_cooperados.dto;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * O detalhe de um cooperado no ano-base: o cadastro dele e tudo que lançou no ano.
 *
 * É o que o modal do painel de controle abre. Os totais vêm prontos, e não
 * somados na tela, pelo mesmo motivo dos pontos de cada curso: a regra é do
 * servidor.
 *
 * `year` volta no corpo de propósito — o modal escreve o ano no título, e ler do
 * que a resposta afirma evita mostrar um ano diferente do que foi de fato
 * consultado.
 */
public record CooperativeMemberYearDetailResponse(
        Integer id,
        String name,
        String email,
        boolean active,
        OffsetDateTime createdAt,
        int year,
        int goalPoints,
        int totalCourses,
        int totalMinutes,
        int totalPoints,
        boolean goalReached,
        List<CooperativeMemberCourseResponse> courses
) {
}
