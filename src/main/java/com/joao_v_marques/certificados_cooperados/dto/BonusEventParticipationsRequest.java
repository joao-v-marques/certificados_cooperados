package com.joao_v_marques.certificados_cooperados.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;

// Recebe a lista de presença inteira, e não só o que mudou: o service compara com o banco
// e resolve o que inserir e o que apagar. Lista vazia é válida e significa ninguém marcado.
public record BonusEventParticipationsRequest(

        @NotNull(message = "Informe a lista de cooperados participantes.")
        List<Integer> cooperativeMemberIds
) {}
