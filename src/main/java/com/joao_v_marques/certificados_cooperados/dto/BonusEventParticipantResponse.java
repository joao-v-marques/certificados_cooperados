package com.joao_v_marques.certificados_cooperados.dto;

// Uma linha da lista de presença: o cooperado e se ele está marcado no evento.
// memberIsActive vem junto porque um cooperado desativado depois do lançamento
// continua aparecendo marcado, e a tela precisa mostrar isso sem deixar editar.
public record BonusEventParticipantResponse(
        Integer cooperativeMemberId,
        String name,
        boolean participated,
        boolean memberIsActive
) {}
