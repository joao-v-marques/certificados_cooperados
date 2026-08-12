package com.joao_v_marques.certificados_cooperados.dto;

// Dto de saída dos tipos de ocorrência, usado para montar o select do lançamento.
// Não devolve isActive porque o endpoint só entrega os ativos — o campo seria
// sempre true e só daria à tela a impressão de que existe escolha.
public record OccurrenceTypeResponse(
        Integer id,
        String name
) {}
