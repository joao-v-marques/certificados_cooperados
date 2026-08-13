package com.joao_v_marques.certificados_cooperados.service;

public final class CoursePointsPolicy {

    // Meta de pontos que o cooperado precisa somar no ano-base.
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
