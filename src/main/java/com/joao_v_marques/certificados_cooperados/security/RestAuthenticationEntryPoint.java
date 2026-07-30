package com.joao_v_marques.certificados_cooperados.security;

import com.joao_v_marques.certificados_cooperados.exception.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.web.AuthenticationEntryPoint;
import tools.jackson.databind.ObjectMapper;

import org.springframework.security.core.AuthenticationException;
import java.io.IOException;

public class RestAuthenticationEntryPoint implements AuthenticationEntryPoint {

    /** Código enviado para a tela de login quando não havia token nenhum. */
    private static final String LOGIN_REQUIRED = "login-necessario";

    /** Código enviado quando o token existia, mas estava expirado ou inválido. */
    private static final String SESSION_EXPIRED = "sessao-expirada";

    private final ObjectMapper objectMapper;

    public RestAuthenticationEntryPoint(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException authException) throws IOException {
        if (request.getServletPath().startsWith("/api/")) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            objectMapper.writeValue(response.getWriter(), ApiError.of("Você precisa estar autenticado para acessar este recurso."));
            return;
        }

        // Sem sessão (a aplicação é stateless) não há flash attribute: o motivo
        // viaja como código na query string e a tela de login o traduz em texto.
        // Só códigos fixos vão na URL — texto livre vindo do cliente acabaria
        // refletido na página.
        boolean invalidToken = Boolean.TRUE.equals(request.getAttribute(JwtAuthenticationFilter.INVALID_TOKEN_ATTRIBUTE));
        String reason = invalidToken ? SESSION_EXPIRED : LOGIN_REQUIRED;

        response.sendRedirect(request.getContextPath() + "/login?erro=" + reason);
    }
}
