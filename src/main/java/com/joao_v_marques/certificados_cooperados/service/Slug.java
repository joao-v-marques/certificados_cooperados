package com.joao_v_marques.certificados_cooperados.service;

import java.text.Normalizer;

/**
 * Texto livre virando nome de pasta e de arquivo.
 *
 * Tira acento, baixa a caixa e deixa só letra, número e hífen — o que sobra é
 * seguro em qualquer sistema de arquivos e dentro de um zip, sem depender da
 * codificação do disco.
 *
 * Mora fora do CourseService porque a gravação do certificado e o download em
 * lote precisam do mesmo resultado: se as duas fatiassem o nome de um jeito
 * diferente, o arquivo baixado deixaria de parecer com o que está no disco.
 */
public final class Slug {

    /** Nome usado quando não sobra nenhum caractere aproveitável. */
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
