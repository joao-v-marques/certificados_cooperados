package com.joao_v_marques.certificados_cooperados.controller;

import com.joao_v_marques.certificados_cooperados.dto.CurrentUserResponse;
import com.joao_v_marques.certificados_cooperados.dto.UserRequest;
import com.joao_v_marques.certificados_cooperados.dto.UserResponse;
import com.joao_v_marques.certificados_cooperados.security.UserPrincipal;
import com.joao_v_marques.certificados_cooperados.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;

@RestController
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/api/v1/users")
    public List<UserResponse> findAll() {
        return userService.findAll();
    }

    // Retorna o usuário atualmente logado, usado na label da navbar
    @GetMapping("/api/v1/users/me")
    public CurrentUserResponse findCurrent(@AuthenticationPrincipal UserPrincipal principal) {
        return userService.findCurrent(principal.getId());
    }

    // POST de um novo usuário na aplicação, recebe os dados pelo @RequestBody
    @PostMapping(value = "/api/v1/users", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<UserResponse> create(@Valid @RequestBody UserRequest request) {

        UserResponse created = userService.create(request);

        URI location = URI.create("/api/v1/users/" + created.id());

        return ResponseEntity.created(location).body(created);
    }
}
