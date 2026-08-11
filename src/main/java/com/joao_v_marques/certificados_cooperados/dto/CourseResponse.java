package com.joao_v_marques.certificados_cooperados.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;

// Dto de retorno, será utilizado para a saída de POST e caso seja necessário listar todos os cursos
public record CourseResponse(
        Integer id,
        String title,
        int totalMinutes,
        LocalDate completionDate,
        String observations,
        OffsetDateTime createdAt,
        String cooperativeMemberName,
        String insertedByName,
        boolean isCooperativism
) {}
