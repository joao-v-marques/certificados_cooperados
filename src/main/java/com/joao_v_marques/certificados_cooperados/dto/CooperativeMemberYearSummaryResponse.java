package com.joao_v_marques.certificados_cooperados.dto;

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
