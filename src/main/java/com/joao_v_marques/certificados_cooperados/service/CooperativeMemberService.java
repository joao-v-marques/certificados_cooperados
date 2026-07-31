package com.joao_v_marques.certificados_cooperados.service;

import com.joao_v_marques.certificados_cooperados.dto.CooperativeMemberRequest;
import com.joao_v_marques.certificados_cooperados.dto.CooperativeMemberResponse;
import com.joao_v_marques.certificados_cooperados.dto.CooperativeMemberYearSummaryResponse;
import com.joao_v_marques.certificados_cooperados.dto.CooperativeMembersYearReportResponse;
import com.joao_v_marques.certificados_cooperados.entity.CooperativeMember;
import com.joao_v_marques.certificados_cooperados.repository.CooperativeMemberRepository;
import com.joao_v_marques.certificados_cooperados.repository.CourseRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.Year;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

@Service
public class CooperativeMemberService {

    // O sistema não existia antes disso; ano fora da faixa é erro de digitação
    // ou parâmetro forjado, não filtro legítimo.
    private static final int MIN_YEAR = 2000;

    private final CooperativeMemberRepository cooperativeMemberRepository;
    private final CourseRepository courseRepository;

    public CooperativeMemberService(CooperativeMemberRepository cooperativeMemberRepository,
                                    CourseRepository courseRepository) {
        this.cooperativeMemberRepository = cooperativeMemberRepository;
        this.courseRepository = courseRepository;
    }

    // GET de todos os cooperative members cadastrados no sistema
    @Transactional(readOnly = true)
    public List<CooperativeMemberResponse> findAll() {
        return cooperativeMemberRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    // GET só dos cooperados ativos, para a select do lançamento de curso: o
    // CourseService recusa curso de cooperado inativo, então oferecer um na tela
    // seria deixar o usuário escolher algo que volta como erro.
    @Transactional(readOnly = true)
    public List<CooperativeMemberResponse> findAllActive() {
        return cooperativeMemberRepository.findActiveOrderByName()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public CooperativeMembersYearReportResponse findYearReport(int year) {

        int currentYear = Year.now().getValue();

        if (year < MIN_YEAR || year > currentYear) {
            throw new IllegalArgumentException(
                    "Informe um ano entre " + MIN_YEAR + " e " + currentYear + ".");
        }

        // completion_date é DATE puro, sem hora, então o BETWEEN inclusivo já
        // pega o ano inteiro — não há a fração de segundo do fim do dia 31/12
        // que obrigaria a usar intervalo semiaberto.
        LocalDate start = LocalDate.of(year, 1, 1);
        LocalDate end = LocalDate.of(year, 12, 31);

        // Uma consulta só traz os cursos do ano; o agrupamento por cooperado é
        // feito aqui para a faixa de pontos ficar no Java, e não espalhada em SQL.
        Map<Integer, YearTotals> totalsByMember = new HashMap<>();

        courseRepository.findMemberMinutesByCompletionDateBetween(start, end)
                .forEach(course -> totalsByMember
                        .computeIfAbsent(course.getCooperativeMemberId(), id -> new YearTotals())
                        .add(course.getTotalMinutes()));

        List<CooperativeMember> activeMembers = cooperativeMemberRepository.findActiveOrderByName();

        List<CooperativeMemberYearSummaryResponse> members = new ArrayList<>(activeMembers.size());

        int membersWithoutCourses = 0;
        int membersWhoReachedGoal = 0;

        for (CooperativeMember member : activeMembers) {
            // Sem lançamento no ano o cooperado nem aparece no mapa: entra zerado.
            YearTotals totals = totalsByMember.getOrDefault(member.getId(), YearTotals.EMPTY);

            boolean goalReached = CoursePointsPolicy.goalReached(totals.points);

            if (totals.courses == 0) {
                membersWithoutCourses++;
            }
            if (goalReached) {
                membersWhoReachedGoal++;
            }

            members.add(new CooperativeMemberYearSummaryResponse(
                    member.getId(),
                    member.getName(),
                    member.getEmail(),
                    totals.courses,
                    totals.points,
                    goalReached
            ));
        }

        return new CooperativeMembersYearReportResponse(
                year,
                CoursePointsPolicy.ANNUAL_GOAL_POINTS,
                activeMembers.size(),
                membersWithoutCourses,
                membersWhoReachedGoal,
                availableYears(year, currentYear),
                members
        );
    }

    /**
     * Anos que o select de ano-base pode oferecer: os que têm curso concluído,
     * mais o ano corrente e o ano consultado — assim a tela nunca fica sem opção
     * em base nova, nem some com o ano que o usuário acabou de escolher.
     * Anos fora da faixa aceita são descartados para o select não oferecer uma
     * opção que o próprio endpoint recusaria.
     */
    private List<Integer> availableYears(int requestedYear, int currentYear) {
        return Stream.concat(courseRepository.findDistinctCompletionYears().stream(),
                        Stream.of(currentYear, requestedYear))
                .filter(year -> year >= MIN_YEAR && year <= currentYear)
                .distinct()
                .sorted(Comparator.reverseOrder())
                .toList();
    }

    /** Acumulador do agrupamento em memória: cursos e pontos de um cooperado no ano. */
    private static final class YearTotals {

        /** Compartilhado por todo cooperado sem lançamento no ano; nunca recebe add. */
        private static final YearTotals EMPTY = new YearTotals();

        private int courses;
        private int points;

        private void add(int totalMinutes) {
            courses++;
            points += CoursePointsPolicy.pointsOf(totalMinutes);
        }
    }

    // POST de um novo CooperativeMember
    @Transactional
    public CooperativeMemberResponse create(CooperativeMemberRequest request) {

        String name = request.name().trim();

        // O email é opcional: o formulário manda string vazia quando não preenchem,
        // e "" gravado em coluna UNIQUE derruba o segundo cooperado sem email.
        String email = StringUtils.hasText(request.email()) ? request.email().trim() : null;

        // regras de negócio que a anotação de validation da dto não cobre
        if (cooperativeMemberRepository.existsByNameIgnoreCase(name)) {
            throw new IllegalArgumentException("Já existe um cooperado com esse nome.");
        }
        if (email != null && cooperativeMemberRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("Já existe um cooperado com esse email.");
        }

        // Montar a entidade, um dto nunca vira entidade sozinho
        CooperativeMember cooperativeMember = new CooperativeMember();
        cooperativeMember.setName(name);
        cooperativeMember.setEmail(email);

        CooperativeMember saved = cooperativeMemberRepository.save(cooperativeMember);

        // Retorna a entidade dto de Request para Response e retorna no banco
        return toResponse(saved);
    }

    private CooperativeMemberResponse toResponse(CooperativeMember cooperativeMember) {
        return new CooperativeMemberResponse(
                cooperativeMember.getId(),
                cooperativeMember.getName(),
                cooperativeMember.getEmail(),
                cooperativeMember.getCreatedAt(),
                cooperativeMember.isActive()
        );
    }
}
