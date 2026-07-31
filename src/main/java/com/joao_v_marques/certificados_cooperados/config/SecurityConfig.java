package com.joao_v_marques.certificados_cooperados.config;

import com.joao_v_marques.certificados_cooperados.security.CustomUserDetailsService;
import com.joao_v_marques.certificados_cooperados.security.JwtAuthenticationFilter;
import com.joao_v_marques.certificados_cooperados.security.JwtService;
import com.joao_v_marques.certificados_cooperados.security.RestAccessDeniedHandler;
import com.joao_v_marques.certificados_cooperados.security.RestAuthenticationEntryPoint;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import tools.jackson.databind.ObjectMapper;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, JwtService jwtService, CustomUserDetailsService userDetailsService, ObjectMapper objectMapper) throws Exception {
        JwtAuthenticationFilter jwtAuthenticationFilter = new JwtAuthenticationFilter(jwtService, userDetailsService);
        RestAuthenticationEntryPoint restAuthenticationEntryPoint = new RestAuthenticationEntryPoint(objectMapper);
        RestAccessDeniedHandler restAccessDeniedHandler = new RestAccessDeniedHandler(objectMapper);

        return http
                .authorizeHttpRequests(auth -> auth
                        // O logout é público de propósito: com o token vencido a
                        // requisição levaria 401 e o cookie ficaria pendurado no
                        // navegador. Quem não está autenticado não perde nada em
                        // pedir para apagar o próprio cookie.
                        .requestMatchers("/login", "/api/v1/auth/login", "/api/v1/auth/logout", "/css/**", "/js/**").permitAll()

                        // Criar usuário é dar acesso à aplicação, então só o
                        // administrador faz. A regra fica aqui, e não em
                        // @PreAuthorize no controller, para todas as permissões
                        // continuarem legíveis em um lugar só.
                        //
                        // hasRole("administrator") casa com a authority
                        // ROLE_administrator, montada pelo UserPrincipal a partir
                        // do nome da role — o prefixo é do Spring Security.
                        //
                        // O verbo entra no matcher de propósito: o GET da mesma
                        // URL é a listagem, que qualquer autenticado enxerga.
                        .requestMatchers(HttpMethod.POST, "/api/v1/users").hasRole("administrator")

                        // A tela do cadastro segue a mesma regra do endpoint que
                        // ela chama. Esconder o item na sidebar não basta: a URL
                        // continua digitável.
                        .requestMatchers("/usuarios").hasRole("administrator")

                        .anyRequest().authenticated())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .csrf(csrf -> csrf.disable())
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(restAuthenticationEntryPoint)
                        .accessDeniedHandler(restAccessDeniedHandler))
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    AuthenticationProvider authenticationProvider(CustomUserDetailsService userDetailsService, PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return provider;
    }

    @Bean
    AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }
}
