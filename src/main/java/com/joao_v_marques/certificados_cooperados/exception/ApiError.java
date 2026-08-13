package com.joao_v_marques.certificados_cooperados.exception;

import java.util.Map;

public record ApiError(String message, Map<String, String> fields) {

    public static ApiError of(String message) {
        return new ApiError(message, Map.of());
    }
}
