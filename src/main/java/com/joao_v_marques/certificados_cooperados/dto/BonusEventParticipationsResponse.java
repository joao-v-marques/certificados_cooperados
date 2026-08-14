package com.joao_v_marques.certificados_cooperados.dto;

import java.time.LocalDate;
import java.util.List;

// Tela da lista de presença de um evento: os dados do evento no topo e todos os cooperados
// que podem ser marcados, já com quem está marcado.
public record BonusEventParticipationsResponse(
        Integer eventId,
        String eventName,
        LocalDate eventDate,
        Integer points,
        boolean eventIsActive,
        int markedCount,
        List<BonusEventParticipantResponse> participants
) {}
