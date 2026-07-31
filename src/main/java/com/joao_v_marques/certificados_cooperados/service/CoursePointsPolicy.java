package com.joao_v_marques.certificados_cooperados.service;

/**
 * Regra de pontuação dos cursos, definida pela cooperativa.
 *
 * A pontuação sai da carga horária do curso, em faixas — não é proporcional:
 *   menos de 8 horas .... 5 pontos
 *   de 8 a 16 horas ..... 10 pontos
 *   acima de 16 horas ... 15 pontos
 *
 * O limite de cada faixa é fechado no topo: exatamente 8h e exatamente 16h
 * valem 10 pontos.
 *
 * A regra fica aqui, e não em SQL, para existir em um lugar só: mudar a faixa
 * ou a meta é mexer neste arquivo, sem tocar em consulta.
 */
public final class CoursePointsPolicy {

    /** Meta de pontos que o cooperado precisa somar no ano-base. */
    public static final int ANNUAL_GOAL_POINTS = 30;

    private static final int EIGHT_HOURS_IN_MINUTES = 8 * 60;
    private static final int SIXTEEN_HOURS_IN_MINUTES = 16 * 60;

    private static final int POINTS_SHORT_COURSE = 5;
    private static final int POINTS_MEDIUM_COURSE = 10;
    private static final int POINTS_LONG_COURSE = 15;

    private CoursePointsPolicy() {
    }

    public static int pointsOf(int totalMinutes) {
        if (totalMinutes < EIGHT_HOURS_IN_MINUTES) {
            return POINTS_SHORT_COURSE;
        }
        if (totalMinutes <= SIXTEEN_HOURS_IN_MINUTES) {
            return POINTS_MEDIUM_COURSE;
        }
        return POINTS_LONG_COURSE;
    }

    public static boolean goalReached(int points) {
        return points >= ANNUAL_GOAL_POINTS;
    }
}
