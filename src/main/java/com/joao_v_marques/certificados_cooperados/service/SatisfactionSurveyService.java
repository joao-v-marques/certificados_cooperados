package com.joao_v_marques.certificados_cooperados.service;

import com.joao_v_marques.certificados_cooperados.dto.SatisfactionSurveyRequest;
import com.joao_v_marques.certificados_cooperados.dto.SatisfactionSurveyResponse;
import com.joao_v_marques.certificados_cooperados.entity.SatisfactionSurvey;
import com.joao_v_marques.certificados_cooperados.entity.User;
import com.joao_v_marques.certificados_cooperados.repository.SatisfactionSurveyRepository;
import com.joao_v_marques.certificados_cooperados.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Service
public class SatisfactionSurveyService {

    private final SatisfactionSurveyRepository satisfactionSurveyRepository;
    private final UserRepository userRepository;

    public SatisfactionSurveyService(SatisfactionSurveyRepository satisfactionSurveyRepository, UserRepository userRepository) {
        this.satisfactionSurveyRepository = satisfactionSurveyRepository;
        this.userRepository = userRepository;
    }

    // GET de todas as pesquisas de satisfação cadastradas ordenado pelo ano ASC
    @Transactional(readOnly = true)
    public List<SatisfactionSurveyResponse> findAllOrderByYearAsc() {
        return satisfactionSurveyRepository.findAllByOrderBySurveyYearAsc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    // POST de uma nova pesquisa de satisfação
    @Transactional
    public SatisfactionSurveyResponse create(SatisfactionSurveyRequest request, Integer currentUserId) {
        // Valida se a FK de insertedBy realmente existe
        User insertedBy = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalArgumentException("Usuário responsável pela inclusão está incorreto"));

        // Montar a entidade, DTO nunca vira entidade sozinha
        SatisfactionSurvey satisfactionSurvey = new SatisfactionSurvey();
        satisfactionSurvey.setSurveyYear(request.surveyYear());
        satisfactionSurvey.setTotalMembers(request.totalMembers());
        satisfactionSurvey.setRespondents(request.respondents());
        satisfactionSurvey.setSatisfactionIndex(request.satisfactionIndex());
        satisfactionSurvey.setInsertedBy(insertedBy);

        SatisfactionSurvey saved = satisfactionSurveyRepository.save(satisfactionSurvey);

        // transforma a entidade para dto de saída(response) e retorna
        return toResponse(saved);
    }

    private SatisfactionSurveyResponse toResponse(SatisfactionSurvey satisfactionSurvey) {
        int notReached = satisfactionSurvey.getTotalMembers() - satisfactionSurvey.getRespondents();

        BigDecimal responseRate = BigDecimal.valueOf(satisfactionSurvey.getRespondents()).multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(satisfactionSurvey.getTotalMembers()), 2, RoundingMode.HALF_UP);

        return new SatisfactionSurveyResponse(
                satisfactionSurvey.getId(),
                satisfactionSurvey.getSurveyYear(),
                satisfactionSurvey.getTotalMembers(),
                satisfactionSurvey.getRespondents(),
                satisfactionSurvey.getSatisfactionIndex(),
                notReached,
                responseRate,
                satisfactionSurvey.getInsertedBy().getName(),
                satisfactionSurvey.getCreatedAt()
        );
    }
}
