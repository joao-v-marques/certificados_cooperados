package com.joao_v_marques.certificados_cooperados.service;

public final class PointsBandPolicy {

    // Teto de cada faixa, em percentual. O índice 0 é a primeira faixa.
    private static final int[] UPPER_BOUNDS_PERCENT = {20, 40, 60, 80, 100};

    public static final int BAND_COUNT = UPPER_BOUNDS_PERCENT.length;

    private PointsBandPolicy() {
    }

    public static int maxPossiblePoints(int totalEventPoints) {
        return totalEventPoints + CoursePointsPolicy.ANNUAL_GOAL_POINTS;
    }

    public static int percentageOf(int totalPoints, int maxPossiblePoints) {
        if (maxPossiblePoints <= 0) {
            return 0;
        }
        return (int) Math.round(totalPoints * 100.0 / maxPossiblePoints);
    }

    public static int bandOf(int percentage) {
        for (int i = 0; i < UPPER_BOUNDS_PERCENT.length; i++) {
            if (percentage <= UPPER_BOUNDS_PERCENT[i]) {
                return i + 1;
            }
        }
        return BAND_COUNT;
    }

    // Limites da faixa (1-based), para a legenda da tela montar "21% a 40%".
    public static int lowerBoundOf(int band) {
        requireValidBand(band);
        return band == 1 ? 0 : UPPER_BOUNDS_PERCENT[band - 2] + 1;
    }

    public static int upperBoundOf(int band) {
        requireValidBand(band);
        return UPPER_BOUNDS_PERCENT[band - 1];
    }

    private static void requireValidBand(int band) {
        if (band < 1 || band > BAND_COUNT) {
            throw new IllegalArgumentException("Faixa inexistente: " + band);
        }
    }
}
