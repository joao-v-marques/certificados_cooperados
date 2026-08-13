package com.joao_v_marques.certificados_cooperados.service;

import java.text.Normalizer;

public final class Slug {

    // Nome usado quando não sobra nenhum caractere aproveitável.
    private static final String FALLBACK = "sem-nome";

    private Slug() {
    }

    public static String of(String text) {
        if (text == null || text.isBlank()) {
            return FALLBACK;
        }

        String withoutAccentMark = Normalizer.normalize(text, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");

        String clear = withoutAccentMark.toLowerCase()
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");

        return clear.isBlank() ? FALLBACK : clear;
    }
}
