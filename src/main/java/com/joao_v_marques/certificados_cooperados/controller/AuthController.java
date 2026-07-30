package com.joao_v_marques.certificados_cooperados.controller;

import com.joao_v_marques.certificados_cooperados.dto.AuthRequest;
import com.joao_v_marques.certificados_cooperados.dto.AuthResponse;
import com.joao_v_marques.certificados_cooperados.security.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    public AuthController(AuthenticationManager authenticationManager, JwtService jwtService) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody AuthRequest request, HttpServletRequest httpRequest) {
        authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(request.username(), request.password()));

        String token = jwtService.generateToken(request.username());

        ResponseCookie cookie = ResponseCookie.from("access_token", token)
                .httpOnly(true)
                .secure(true)
                .sameSite("Lax")
                .path(httpRequest.getContextPath())
                .maxAge(Duration.ofMillis(jwtService.getExpirationMillis()))
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(new AuthResponse(token));

    }
}
