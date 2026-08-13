package com.joao_v_marques.certificados_cooperados.dto;

import java.time.OffsetDateTime;
import java.util.List;

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
