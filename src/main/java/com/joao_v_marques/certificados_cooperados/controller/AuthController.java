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

        ResponseCookie cookie = accessTokenCookie(token,
                Duration.ofMillis(jwtService.getExpirationMillis()),
                httpRequest.getContextPath());

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(new AuthResponse(token));

    }

    /**
     * Encerra a sessão apagando o cookie do token.
     *
     * Precisa passar pelo servidor: o access_token é httpOnly, então o JavaScript
     * da página não enxerga nem apaga esse cookie — só um Set-Cookie vencido tira
     * ele do navegador.
     *
     * O token em si continua tecnicamente válido até expirar, porque a autenticação
     * é stateless e não há lista de revogados. Para quem usa a aplicação pelo
     * navegador isso não muda nada — sem o cookie, não há como apresentá-lo.
     * TODO: se um dia houver necessidade de invalidar de fato (logout remoto,
     * conta comprometida), aí sim vai precisar de uma lista de tokens revogados.
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest httpRequest) {

        ResponseCookie cookie = accessTokenCookie("", Duration.ZERO, httpRequest.getContextPath());

        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .build();
    }

    /**
     * O cookie do token, montado num lugar só.
     *
     * Login e logout precisam usar exatamente os mesmos atributos (nome, path,
     * httpOnly, secure e sameSite): o navegador identifica o cookie por essa
     * combinação, e qualquer diferença faria o logout criar um cookie novo em vez
     * de substituir o que está lá — a sessão continuaria de pé.
     */
    private ResponseCookie accessTokenCookie(String value, Duration maxAge, String contextPath) {
        return ResponseCookie.from("access_token", value)
                .httpOnly(true)
                .secure(true)
                .sameSite("Lax")
                .path(contextPath)
                .maxAge(maxAge)
                .build();
    }
}
