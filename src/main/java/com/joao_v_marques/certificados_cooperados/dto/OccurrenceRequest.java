package com.joao_v_marques.certificados_cooperados.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

// Dto para realizar o POST das ocorrências (ADICIONADO NOTAÇÕES DE BEAN VALIDATION)
public record OccurrenceRequest(

        @NotNull(message = "Informe o tipo da ocorrência.")
        Integer occurrenceTypeId,

        @NotNull(message = "Informe o cooperado que solicitou a ocorrência.")
        Integer cooperativeMemberId,

        // Sem @DateTimeFormat de propósito, ao contrário de CourseRequest: lá o
        // corpo é multipart e quem converte a string é o binder do Spring, que
        // sem a anotação cairia no formato do locale da requisição. Aqui o corpo
        // é JSON e quem converte é o Jackson, que já lê ISO (yyyy-MM-dd) e ignora
        // a anotação — deixá-la aqui só sugeriria uma garantia que ela não dá.
        @NotNull(message = "Informe a data da ocorrência.")
        @PastOrPresent(message = "A data da ocorrência não pode ser futura.")
        LocalDate occurrenceDate,

        // Obrigatória: na ocorrência a observação é o próprio conteúdo do
        // registro, e não um complemento como no curso. O limite é maior que o de
        // CourseRequest pelo mesmo motivo — aqui é onde o caso é descrito.
        @NotBlank(message = "Descreva a ocorrência nas observações.")
        @Size(max = 2000, message = "As observações devem ter no máximo 2000 caracteres.")
        String observations
) {}
