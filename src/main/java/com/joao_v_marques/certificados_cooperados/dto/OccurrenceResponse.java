package com.joao_v_marques.certificados_cooperados.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;

// Dto de retorno, usado tanto na saída do POST quanto na listagem das ocorrências.
// Devolve os nomes já resolvidos, e não os ids das FK: quem consome é a tabela da
// tela, que mostra nome de cooperado e de tipo, nunca o id.
//
// A exceção é cooperativeMemberId, que fica para a tela poder ligar a linha ao
// cooperado sem precisar casar por nome.
public record OccurrenceResponse(
        Integer id,
        LocalDate occurrenceDate,
        String observations,
        OffsetDateTime createdAt,
        String occurrenceTypeName,
        Integer cooperativeMemberId,
        String cooperativeMemberName,
        String insertedByName
) {}
