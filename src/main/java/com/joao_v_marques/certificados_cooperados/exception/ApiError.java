package com.joao_v_marques.certificados_cooperados.exception;

import java.util.Map;

// Corpo padrão para retornar erros da API
// message -> mensagem geral, sempre presente para identificar o erro
// fields -> erros por campo do formulário; vazio quando não se aplica
public record ApiError(String message, Map<String, String> fields) {

    public static ApiError of(String message) {
        return new ApiError(message, Map.of());
    }
}
