package com.joao_v_marques.certificados_cooperados.controller;

import com.joao_v_marques.certificados_cooperados.dto.CurrentUserResponse;
import com.joao_v_marques.certificados_cooperados.dto.UserResponse;
import com.joao_v_marques.certificados_cooperados.security.UserPrincipal;
import com.joao_v_marques.certificados_cooperados.service.UserService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

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

    // Quem está logado agora, para a topbar. Quem responde é sempre o dono do
    // token — o id vem do SecurityContext, nunca da URL, então não há como pedir
    // os dados de outro usuário por aqui.
    @GetMapping("/api/v1/users/me")
    public CurrentUserResponse findCurrent(@AuthenticationPrincipal UserPrincipal principal) {
        return userService.findCurrent(principal.getId());
    }
}
