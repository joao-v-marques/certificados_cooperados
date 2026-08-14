package com.joao_v_marques.certificados_cooperados.repository;

import com.joao_v_marques.certificados_cooperados.entity.BonusEventParticipation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface BonusEventParticipationRepository extends JpaRepository<BonusEventParticipation, Integer> {

    // Uma linha por participação do ano, o service agrupa pelo Cooperado
    interface MemberEventPoints {
        Integer getCooperativeMemberId();
        Integer getBonusEventId();
        Integer getPoints();
    }

    @Query("""
        SELECT 
            p.cooperativeMember.id AS cooperativeMemberId,
            p.bonusEvent.id AS bonusEventId,
            p.bonusEvent.points as points
        FROM BonusEventParticipation p
        WHERE p.bonusEvent.eventDate BETWEEN :start AND :end
        AND p.bonusEvent.isActive = true
    """)
    List<MemberEventPoints> findPointsByEventDateBetween(@Param("start") LocalDate start, @Param("end") LocalDate end);

    // Para montar a lista de presença de um evento: Só id's já marcados
    @Query("""
        SELECT
            p.cooperativeMember.id
        FROM BonusEventParticipation p
        WHERE p.bonusEvent.id = :eventId
    """)
    List<Integer> findMemberIdsByEventId(@Param("eventId") Integer eventId);

    // Usado no diff da lista de presença: apaga só quem foi desmarcado na tela.
    void deleteByBonusEventIdAndCooperativeMemberIdIn(Integer bonusEventId,
                                                      Collection<Integer> cooperativeMemberIds);
}
