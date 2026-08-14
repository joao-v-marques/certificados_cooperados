package com.joao_v_marques.certificados_cooperados.dto;

import java.util.List;

// Uma linha da matriz. participatedEventIds vai como lista em vez de uma célula por evento:
// com 200 cooperados e 6 eventos seriam 1200 células, quase todas vazias.
public record MemberBonusPointsResponse(
        Integer id,
        String name,
        int coursePoints,
        int bonusPoints,
        int totalPoints,
        int percentage,
        int band,
        List<Integer> participatedEventIds
) {}
