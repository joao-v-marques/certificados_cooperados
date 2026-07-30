package com.joao_v_marques.certificados_cooperados.service;

import com.joao_v_marques.certificados_cooperados.dto.CooperativeMemberRequest;
import com.joao_v_marques.certificados_cooperados.dto.CooperativeMemberResponse;
import com.joao_v_marques.certificados_cooperados.entity.CooperativeMember;
import com.joao_v_marques.certificados_cooperados.repository.CooperativeMemberRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
public class CooperativeMemberService {

    private final CooperativeMemberRepository cooperativeMemberRepository;

    public CooperativeMemberService(CooperativeMemberRepository cooperativeMemberRepository) {
        this.cooperativeMemberRepository = cooperativeMemberRepository;
    }

    @Transactional(readOnly = true)
    public List<CooperativeMemberResponse> findAll() {
        return cooperativeMemberRepository.findAll()
                .stream()
                .map(cooperativeMember -> new CooperativeMemberResponse(
                        cooperativeMember.getId(),
                        cooperativeMember.getName(),
                        cooperativeMember.getEmail(),
                        cooperativeMember.getCreatedAt(),
                        cooperativeMember.isActive()
                ))
                .toList();
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
