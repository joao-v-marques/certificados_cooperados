package com.joao_v_marques.certificados_cooperados.service;

import com.joao_v_marques.certificados_cooperados.dto.BonusEventParticipantResponse;
import com.joao_v_marques.certificados_cooperados.dto.BonusEventParticipationsRequest;
import com.joao_v_marques.certificados_cooperados.dto.BonusEventParticipationsResponse;
import com.joao_v_marques.certificados_cooperados.dto.BonusEventRequest;
import com.joao_v_marques.certificados_cooperados.dto.BonusEventResponse;
import com.joao_v_marques.certificados_cooperados.entity.BonusEvent;
import com.joao_v_marques.certificados_cooperados.entity.BonusEventParticipation;
import com.joao_v_marques.certificados_cooperados.entity.CooperativeMember;
import com.joao_v_marques.certificados_cooperados.entity.User;
import com.joao_v_marques.certificados_cooperados.repository.BonusEventParticipationRepository;
import com.joao_v_marques.certificados_cooperados.repository.BonusEventRepository;
import com.joao_v_marques.certificados_cooperados.repository.CooperativeMemberRepository;
import com.joao_v_marques.certificados_cooperados.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class BonusEventService {

    private final BonusEventRepository bonusEventRepository;
    private final BonusEventParticipationRepository participationRepository;
    private final CooperativeMemberRepository cooperativeMemberRepository;
    private final UserRepository userRepository;

    public BonusEventService(BonusEventRepository bonusEventRepository,
                             BonusEventParticipationRepository participationRepository,
                             CooperativeMemberRepository cooperativeMemberRepository,
                             UserRepository userRepository) {
        this.bonusEventRepository = bonusEventRepository;
        this.participationRepository = participationRepository;
        this.cooperativeMemberRepository = cooperativeMemberRepository;
        this.userRepository = userRepository;
    }

    // GET dos eventos de um ano, incluindo os desativados
    @Transactional(readOnly = true)
    public List<BonusEventResponse> findByYear(int year) {

        BaseYearPolicy.validate(year);

        return bonusEventRepository
                .findByEventDateBetweenOrderByEventDateAsc(BaseYearPolicy.start(year), BaseYearPolicy.end(year))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    // POST de um novo evento
    @Transactional
    public BonusEventResponse create(BonusEventRequest request, Integer currentUserId) {

        String name = request.name().trim();

        // O ano vem da data do evento; ano fora da faixa é digitação errada, não filtro válido
        BaseYearPolicy.validate(request.eventDate().getYear());

        if (bonusEventRepository.existsByNameIgnoreCaseAndEventDate(name, request.eventDate())) {
            throw new IllegalArgumentException("Já existe um evento com esse nome nessa data.");
        }

        User insertedBy = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalStateException("Usuário responsável não encontrado."));

        // Montar a entidade, o DTO nunca vira entidade sozinho
        BonusEvent bonusEvent = new BonusEvent();
        bonusEvent.setName(name);
        bonusEvent.setEventDate(request.eventDate());
        bonusEvent.setPoints(request.points());
        bonusEvent.setInsertedBy(insertedBy);

        return toResponse(bonusEventRepository.save(bonusEvent));
    }

    // UPDATE de um evento já existente
    @Transactional
    public BonusEventResponse update(Integer id, BonusEventRequest request) {

        BonusEvent bonusEvent = bonusEventRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("O evento que tentou editar não existe."));

        String name = request.name().trim();

        BaseYearPolicy.validate(request.eventDate().getYear());

        // O IdNot evita que o próprio evento se rejeite quando o nome não muda
        if (bonusEventRepository.existsByNameIgnoreCaseAndEventDateAndIdNot(name, request.eventDate(), id)) {
            throw new IllegalArgumentException("Já existe um evento com esse nome nessa data.");
        }

        bonusEvent.setName(name);
        bonusEvent.setEventDate(request.eventDate());
        bonusEvent.setPoints(request.points());

        return toResponse(bonusEvent);
    }

    // DELETE lógico: o evento sai do relatório mas a lista de presença é preservada
    @Transactional
    public BonusEventResponse delete(Integer id) {

        BonusEvent bonusEvent = bonusEventRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("O evento que tentou excluir não existe."));

        bonusEvent.setActive(false);

        return toResponse(bonusEvent);
    }

    // GET da lista de presença de um evento
    @Transactional(readOnly = true)
    public BonusEventParticipationsResponse findParticipations(Integer eventId) {

        BonusEvent bonusEvent = bonusEventRepository.findById(eventId)
                .orElseThrow(() -> new IllegalArgumentException("Evento não encontrado."));

        Set<Integer> marked = new HashSet<>(participationRepository.findMemberIdsByEventId(eventId));

        return new BonusEventParticipationsResponse(
                bonusEvent.getId(),
                bonusEvent.getName(),
                bonusEvent.getEventDate(),
                bonusEvent.getPoints(),
                bonusEvent.isActive(),
                marked.size(),
                selectableMembers(marked)
        );
    }

    // PUT da lista de presença: recebe o conjunto final e resolve o que mudou
    @Transactional
    public BonusEventParticipationsResponse saveParticipations(Integer eventId,
                                                               BonusEventParticipationsRequest request,
                                                               Integer currentUserId) {

        BonusEvent bonusEvent = bonusEventRepository.findById(eventId)
                .orElseThrow(() -> new IllegalArgumentException("Evento não encontrado."));

        if (!bonusEvent.isActive()) {
            throw new IllegalArgumentException("Este evento está desativado.");
        }

        Set<Integer> desired = new HashSet<>(request.cooperativeMemberIds());
        Set<Integer> current = new HashSet<>(participationRepository.findMemberIdsByEventId(eventId));

        // Desmarcados: estavam no banco e não voltaram na requisição
        Set<Integer> toRemove = new HashSet<>(current);
        toRemove.removeAll(desired);

        // Novos: vieram na requisição e ainda não estavam no banco
        Set<Integer> toAdd = new HashSet<>(desired);
        toAdd.removeAll(current);

        if (!toRemove.isEmpty()) {
            participationRepository.deleteByBonusEventIdAndCooperativeMemberIdIn(eventId, toRemove);
        }

        if (!toAdd.isEmpty()) {
            User insertedBy = userRepository.findById(currentUserId)
                    .orElseThrow(() -> new IllegalStateException("Usuário responsável não encontrado."));

            List<CooperativeMember> membersToAdd = cooperativeMemberRepository.findAllById(toAdd);

            if (membersToAdd.size() != toAdd.size()) {
                throw new IllegalArgumentException("Algum cooperado informado não foi encontrado.");
            }

            List<BonusEventParticipation> participations = new ArrayList<>(membersToAdd.size());

            for (CooperativeMember member : membersToAdd) {
                // O cooperado inativo nem aparece na tela, mas a API continua alcançável
                // por quem monta a requisição na mão. A checagem só vale para quem está
                // entrando agora: quem já estava marcado antes de ser desativado permanece.
                if (!member.isActive()) {
                    throw new IllegalArgumentException("O cooperado " + member.getName() + " está inativo.");
                }

                BonusEventParticipation participation = new BonusEventParticipation();
                participation.setBonusEvent(bonusEvent);
                participation.setCooperativeMember(member);
                participation.setInsertedBy(insertedBy);

                participations.add(participation);
            }

            participationRepository.saveAll(participations);
        }

        return new BonusEventParticipationsResponse(
                bonusEvent.getId(),
                bonusEvent.getName(),
                bonusEvent.getEventDate(),
                bonusEvent.getPoints(),
                bonusEvent.isActive(),
                desired.size(),
                selectableMembers(desired)
        );
    }

    // Cooperados que a tela pode oferecer: os ativos, mais os que já estão marcados neste
    // evento e foram desativados depois. Sem esses últimos, salvar a tela apagaria a
    // participação deles sem ninguém ter desmarcado nada.
    private List<BonusEventParticipantResponse> selectableMembers(Set<Integer> marked) {

        Map<Integer, CooperativeMember> byId = new LinkedHashMap<>();

        cooperativeMemberRepository.findActiveOrderByName()
                .forEach(member -> byId.put(member.getId(), member));

        Set<Integer> markedButInactive = new HashSet<>(marked);
        markedButInactive.removeAll(byId.keySet());

        if (!markedButInactive.isEmpty()) {
            cooperativeMemberRepository.findAllById(markedButInactive)
                    .forEach(member -> byId.put(member.getId(), member));
        }

        return byId.values()
                .stream()
                .sorted(Comparator.comparing(CooperativeMember::getName, String.CASE_INSENSITIVE_ORDER))
                .map(member -> new BonusEventParticipantResponse(
                        member.getId(),
                        member.getName(),
                        marked.contains(member.getId()),
                        member.isActive()))
                .toList();
    }

    private BonusEventResponse toResponse(BonusEvent bonusEvent) {
        return new BonusEventResponse(
                bonusEvent.getId(),
                bonusEvent.getName(),
                bonusEvent.getEventDate(),
                bonusEvent.getPoints(),
                bonusEvent.isActive()
        );
    }
}
