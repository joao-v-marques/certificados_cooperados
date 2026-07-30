package com.joao_v_marques.certificados_cooperados.controller;

import com.joao_v_marques.certificados_cooperados.dto.CooperativeMemberRequest;
import com.joao_v_marques.certificados_cooperados.dto.CooperativeMemberResponse;
import com.joao_v_marques.certificados_cooperados.service.CooperativeMemberService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
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

    // Cooperado não tem upload, então o corpo é JSON: @RequestBody, e não
    // @ModelAttribute como no lançamento de curso (lá o corpo é multipart)
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<CooperativeMemberResponse> create(@Valid @RequestBody CooperativeMemberRequest request) {

        CooperativeMemberResponse created = cooperativeMemberService.create(request);

        URI location = URI.create("/api/v1/cooperative-members/" + created.id());

        return ResponseEntity.created(location).body(created);
    }
}
