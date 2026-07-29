package com.joao_v_marques.certificados_cooperados.controller;

import com.joao_v_marques.certificados_cooperados.dto.CooperativeMemberResponse;
import com.joao_v_marques.certificados_cooperados.service.CooperativeMemberService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/cooperative-members")
public class CooperativeMemberController {

    private final CooperativeMemberService cooperativeMemberService;

    public CooperativeMemberController(CooperativeMemberService cooperativeMemberService) {
        this.cooperativeMemberService = cooperativeMemberService;
    }

    @GetMapping
    public List<CooperativeMemberResponse> findAll() {
        return cooperativeMemberService.findAll();
    }
}
