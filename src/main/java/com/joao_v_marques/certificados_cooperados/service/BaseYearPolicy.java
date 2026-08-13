package com.joao_v_marques.certificados_cooperados.service;

import java.time.LocalDate;
import java.time.Year;

public final class BaseYearPolicy {

    // O sistema não existia antes disso; ano fora da faixa é erro de digitação ou parâmetro forjado, não filtro legítimo.
    public static final int MIN_YEAR = 2000;

    private BaseYearPolicy() {
    }

    public static void validate(int year) {
        int currentYear = Year.now().getValue();

        if (year < MIN_YEAR || year > currentYear) {
            throw new IllegalArgumentException(
                    "Informe um ano entre " + MIN_YEAR + " e " + currentYear + ".");
        }
    }

    public static LocalDate start(int year) {
        return LocalDate.of(year, 1, 1);
    }

    public static LocalDate end(int year) {
        return LocalDate.of(year, 12, 31);
    }
}
