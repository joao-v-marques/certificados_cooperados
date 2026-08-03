package com.joao_v_marques.certificados_cooperados.dto;

import java.time.LocalDate;

/**
 * Um curso do cooperado no ano-base, do jeito que o detalhe precisa listar.
 *
 * `points` vem calculado do servidor: a faixa de pontuação é regra de negócio
 * (CoursePointsPolicy) e a tela não pode reimplementá-la, ou a conta do detalhe
 * passa a divergir da conta do painel na primeira mudança de faixa.
 *
 * `certificateId` é o que o botão de download de um certificado só usa. Vem nulo
 * quando o curso não tem arquivo — hoje o lançamento sempre grava um, mas o
 * schema não impede um curso sem certificado, e a tela precisa saber disso em
 * vez de oferecer um download que volta em erro.
 */
public record CooperativeMemberCourseResponse(
        Integer id,
        String title,
        int totalMinutes,
        LocalDate completionDate,
        int points,
        Integer certificateId,
        String certificateFilename
) {
}
