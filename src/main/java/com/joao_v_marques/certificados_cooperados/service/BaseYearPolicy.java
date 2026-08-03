package com.joao_v_marques.certificados_cooperados.service;

import java.time.LocalDate;
import java.time.Year;

/**
 * O ano-base dos relatórios: o que é aceito e em que período ele se traduz.
 *
 * Fica em um lugar só porque três caminhos usam o mesmo recorte — o relatório do
 * painel, o detalhe de um cooperado e o download dos certificados do ano. Faixa
 * repetida em cada um vira faixa diferente na primeira vez que alguém mexer em
 * uma delas.
 */
public final class BaseYearPolicy {

    /** O sistema não existia antes disso; ano fora da faixa é erro de digitação ou parâmetro forjado, não filtro legítimo. */
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

    // completion_date é DATE puro, sem hora, então o BETWEEN inclusivo já pega o
    // ano inteiro — não há a fração de segundo do fim do dia 31/12 que obrigaria
    // a usar intervalo semiaberto.
    public static LocalDate start(int year) {
        return LocalDate.of(year, 1, 1);
    }

    public static LocalDate end(int year) {
        return LocalDate.of(year, 12, 31);
    }
}
