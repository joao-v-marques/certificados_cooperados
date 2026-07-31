package com.joao_v_marques.certificados_cooperados.controller;

import com.joao_v_marques.certificados_cooperados.dto.CourseRequest;
import com.joao_v_marques.certificados_cooperados.dto.CourseResponse;
import com.joao_v_marques.certificados_cooperados.security.UserPrincipal;
import com.joao_v_marques.certificados_cooperados.service.CourseService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;

@RestController
@RequestMapping("/api/v1/courses")
public class CourseController {

    private final CourseService courseService;
    public CourseController(CourseService courseService) {
        this.courseService = courseService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<CourseResponse> create(@Valid @ModelAttribute CourseRequest request, @RequestPart("certificate") MultipartFile certificate, @AuthenticationPrincipal UserPrincipal currentUser) {
        // quem lança o curso é sempre o usuário autenticado; a rota exige login no SecurityConfig
        Integer currentUserId = currentUser.getId();

        CourseResponse created = courseService.create(request, certificate, currentUserId);

        URI location = URI.create("/api/v1/courses/" + created.id());

        return ResponseEntity.created(location).body(created);
    }
}
