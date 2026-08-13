package com.joao_v_marques.certificados_cooperados.dto;

import java.time.LocalDate;

public record CooperativeMemberCourseResponse(
        Integer id,
        String title,
        int totalMinutes,
        LocalDate completionDate,
        boolean isCooperativism,
        int points,
        Integer certificateId,
        String certificateFilename
) {
}
