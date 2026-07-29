package com.joao_v_marques.certificados_cooperados.dto;

import jakarta.validation.constraints.*;

import java.time.LocalDate;

// Dto para realizar o POST dos courses (ADICIONADO NOTAÇÕES DE BEAN VALIDATION)
public record CourseRequest(

        @NotBlank(message = "Informe o título do curso.")
        @Size(max = 255, message = "O título deve ter no máximo 255 caracteres.")
        String title,

        @NotNull(message = "Informe a carga horária.")
        @Positive(message = "A carga horária precisa ser maior que zero.")
        Integer totalMinutes,

        @NotNull(message = "Informe a data de conclusão.")
        @PastOrPresent(message = "A data de conclusão não pode ser futura.")
        LocalDate completionDate,

        @Size(max = 1000, message = "As observações devem ter no máximo 1000 caracteres.")
        String observations,

        @NotNull(message = "Não foi encontrado nenhum cooperado, insira um válido.")
        Integer cooperativeMemberId
) {}
