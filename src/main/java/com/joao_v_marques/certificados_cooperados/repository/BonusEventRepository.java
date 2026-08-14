package com.joao_v_marques.certificados_cooperados.repository;

import com.joao_v_marques.certificados_cooperados.entity.BonusEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface BonusEventRepository extends JpaRepository<BonusEvent, Integer> {

    // Colunas da matriz de pontuação premiada: os eventos ativos do ano, em ordem cronológica.
    // O evento desativado fica de fora, senão desativar não mudaria nada no relatório.
    @Query("""
            select e from BonusEvent e
            where e.eventDate between :start and :end
              and e.isActive = true
            order by e.eventDate asc
            """)
    List<BonusEvent> findActiveByEventDateBetween(@Param("start") LocalDate start,
                                                  @Param("end") LocalDate end);

    // Tela de manutenção dos eventos: traz também os desativados, senão não há como vê-los.
    List<BonusEvent> findByEventDateBetweenOrderByEventDateAsc(LocalDate start, LocalDate end);

    // Anos que já têm evento lançado. O service une com os anos de curso antes de montar
    // o select de ano-base: um ano só com palestra não pode sumir da tela.
    @Query("""
            select distinct year(e.eventDate)
            from BonusEvent e
            order by year(e.eventDate) desc
            """)
    List<Integer> findDistinctEventYears();

    // Espelha a uq_bonus_event_date do banco, para o service devolver mensagem de negócio
    // antes de a constraint estourar.
    boolean existsByNameIgnoreCaseAndEventDate(String name, LocalDate eventDate);

    // Mesma checagem no update, ignorando o próprio registro editado — sem o IdNot, salvar
    // um evento sem trocar o nome faria ele se rejeitar sozinho.
    boolean existsByNameIgnoreCaseAndEventDateAndIdNot(String name, LocalDate eventDate, Integer id);
}
