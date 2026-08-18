package com.joao_v_marques.certificados_cooperados.service;

import com.joao_v_marques.certificados_cooperados.dto.BonusEventColumnResponse;
import com.joao_v_marques.certificados_cooperados.dto.BonusPointsReportResponse;
import com.joao_v_marques.certificados_cooperados.dto.MemberBonusPointsResponse;
import com.joao_v_marques.certificados_cooperados.dto.PointsBandCountResponse;
import com.joao_v_marques.certificados_cooperados.dto.PointsBandResponse;
import com.joao_v_marques.certificados_cooperados.dto.PointsBandsReportResponse;
import com.joao_v_marques.certificados_cooperados.entity.BonusEvent;
import com.joao_v_marques.certificados_cooperados.entity.CooperativeMember;
import com.joao_v_marques.certificados_cooperados.repository.BonusEventParticipationRepository;
import com.joao_v_marques.certificados_cooperados.repository.BonusEventRepository;
import com.joao_v_marques.certificados_cooperados.repository.CooperativeMemberRepository;
import com.joao_v_marques.certificados_cooperados.repository.CourseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.Year;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import java.util.stream.Stream;

@Service
public class BonusPointsService {

    private final BonusEventRepository bonusEventRepository;
    private final BonusEventParticipationRepository participationRepository;
    private final CooperativeMemberRepository cooperativeMemberRepository;
    private final CourseRepository courseRepository;

    public BonusPointsService(BonusEventRepository bonusEventRepository,
                              BonusEventParticipationRepository participationRepository,
                              CooperativeMemberRepository cooperativeMemberRepository,
                              CourseRepository courseRepository) {
        this.bonusEventRepository = bonusEventRepository;
        this.participationRepository = participationRepository;
        this.cooperativeMemberRepository = cooperativeMemberRepository;
        this.courseRepository = courseRepository;
    }

    @Transactional(readOnly = true)
    public BonusPointsReportResponse findReport(int year) {

        BaseYearPolicy.validate(year);

        int currentYear = Year.now().getValue();

        LocalDate start = BaseYearPolicy.start(year);
        LocalDate end = BaseYearPolicy.end(year);

        // 1. As colunas da matriz. A soma dos pontos delas é o insumo do denominador.
        List<BonusEvent> events = bonusEventRepository.findActiveByEventDateBetween(start, end);

        int totalEventPoints = events.stream()
                .mapToInt(BonusEvent::getPoints)
                .sum();

        // O denominador é do ano, não do cooperado: calculado uma vez, fora do laço.
        int maxPossiblePoints = PointsBandPolicy.maxPossiblePoints(totalEventPoints);

        Map<Integer, YearTotals> totalsByMember = new HashMap<>();

        // 2. As participações do ano, agrupadas por cooperado.
        participationRepository.findPointsByEventDateBetween(start, end)
                .forEach(participation -> totalsByMember
                        .computeIfAbsent(participation.getCooperativeMemberId(), id -> new YearTotals())
                        .addEvent(participation.getBonusEventId(), participation.getPoints()));

        // 3. Os pontos de curso saem da conta que já existe; não reescrever aqui.
        courseRepository.findMemberMinutesByCompletionDateBetween(start, end)
                .forEach(course -> totalsByMember
                        .computeIfAbsent(course.getCooperativeMemberId(), id -> new YearTotals())
                        .addCourse(course.getTotalMinutes()));

        // 4. As linhas.
        List<CooperativeMember> activeMembers = cooperativeMemberRepository.findActiveOrderByName();

        List<MemberBonusPointsResponse> members = new ArrayList<>(activeMembers.size());

        for (CooperativeMember member : activeMembers) {
            // Sem lançamento nenhum no ano o cooperado nem aparece no mapa: entra zerado.
            YearTotals totals = totalsByMember.getOrDefault(member.getId(), YearTotals.EMPTY);

            int totalPoints = totals.coursePoints + totals.bonusPoints;
            int percentage = PointsBandPolicy.percentageOf(totalPoints, maxPossiblePoints);

            members.add(new MemberBonusPointsResponse(
                    member.getId(),
                    member.getName(),
                    totals.coursePoints,
                    totals.bonusPoints,
                    totalPoints,
                    percentage,
                    PointsBandPolicy.bandOf(percentage),
                    totals.sortedEventIds()
            ));
        }

        return new BonusPointsReportResponse(
                year,
                totalEventPoints,
                CoursePointsPolicy.ANNUAL_GOAL_POINTS,
                maxPossiblePoints,
                activeMembers.size(),
                availableYears(year, currentYear),
                bands(),
                events.stream().map(this::toColumn).toList(),
                members
        );
    }

    // Resumo por faixa do ano: reaproveita o findReport já existente e só tabula o band de
    // cada linha, em vez de recalcular a policy — uma única fonte de verdade para o cálculo.
    @Transactional(readOnly = true)
    public PointsBandsReportResponse findBandsSummary(int year) {

        BonusPointsReportResponse report = findReport(year);

        Map<Integer, Integer> countByBand = new HashMap<>();
        for (MemberBonusPointsResponse member : report.members()) {
            countByBand.merge(member.band(), 1, Integer::sum);
        }

        List<PointsBandCountResponse> bands = IntStream.rangeClosed(1, PointsBandPolicy.BAND_COUNT)
                .mapToObj(band -> new PointsBandCountResponse(
                        band,
                        PointsBandPolicy.lowerBoundOf(band),
                        PointsBandPolicy.upperBoundOf(band),
                        countByBand.getOrDefault(band, 0)
                ))
                .toList();

        return new PointsBandsReportResponse(
                report.year(),
                report.totalMembers(),
                report.availableYears(),
                bands
        );
    }

    // Os anos precisam vir das duas fontes: um ano que teve palestra mas nenhum curso
    // lançado sumiria do select e ficaria inalcançável pela tela.
    private List<Integer> availableYears(int requestedYear, int currentYear) {
        return Stream.of(
                        courseRepository.findDistinctCompletionYears().stream(),
                        bonusEventRepository.findDistinctEventYears().stream(),
                        Stream.of(currentYear, requestedYear))
                .flatMap(years -> years)
                .filter(year -> year >= BaseYearPolicy.MIN_YEAR && year <= currentYear)
                .distinct()
                .sorted(Comparator.reverseOrder())
                .toList();
    }

    private List<PointsBandResponse> bands() {
        return IntStream.rangeClosed(1, PointsBandPolicy.BAND_COUNT)
                .mapToObj(band -> new PointsBandResponse(
                        band,
                        PointsBandPolicy.lowerBoundOf(band),
                        PointsBandPolicy.upperBoundOf(band)))
                .toList();
    }

    private BonusEventColumnResponse toColumn(BonusEvent event) {
        return new BonusEventColumnResponse(
                event.getId(),
                event.getName(),
                event.getEventDate(),
                event.getPoints()
        );
    }

    // Acumulador do agrupamento em memória: pontos de curso, pontos premiados e em quais
    // eventos o cooperado esteve, no ano.
    private static final class YearTotals {

        // Compartilhado por todo cooperado sem lançamento no ano; nunca recebe add.
        private static final YearTotals EMPTY = new YearTotals();

        private int coursePoints;
        private int bonusPoints;

        private final List<Integer> eventIds = new ArrayList<>();

        private void addCourse(int totalMinutes) {
            coursePoints += CoursePointsPolicy.pointsOf(totalMinutes);
        }

        private void addEvent(int eventId, int points) {
            bonusPoints += points;
            eventIds.add(eventId);
        }

        // Ordenado só para a resposta sair estável entre chamadas; a tela usa como conjunto.
        private List<Integer> sortedEventIds() {
            return eventIds.stream().sorted().toList();
        }
    }
}
