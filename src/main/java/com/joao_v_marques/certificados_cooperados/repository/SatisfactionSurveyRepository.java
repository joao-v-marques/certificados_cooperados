package com.joao_v_marques.certificados_cooperados.repository;

import com.joao_v_marques.certificados_cooperados.entity.SatisfactionSurvey;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SatisfactionSurveyRepository extends JpaRepository<SatisfactionSurvey, Integer> {

    // Função para validar se já existe pesquisa no ano inserido (usar na hora da inserção)
    boolean existsBySurveyYear(int surveyYear);

    boolean existsBySurveyYearAndIdNot(int surveyYear, Integer id);

    // GET das pesquisas ordenadas ASC e DESC pelo ano, em vez de ordenar pelo ID
    List<SatisfactionSurvey> findAllByOrderBySurveyYearDesc();
    List<SatisfactionSurvey> findAllByOrderBySurveyYearAsc();
}
