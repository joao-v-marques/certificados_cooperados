package com.joao_v_marques.certificados_cooperados.service;

import com.joao_v_marques.certificados_cooperados.dto.CooperativeMemberResponse;
import com.joao_v_marques.certificados_cooperados.repository.CooperativeMemberRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Service;

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
}
