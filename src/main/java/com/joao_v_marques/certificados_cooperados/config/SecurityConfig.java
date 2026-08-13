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
                        // Logout é público de propósito, caso alguém não autenticado tente fazer logout, retorna 401 e só exclui o próprio cookie.
                        .requestMatchers("/login", "/api/v1/auth/login", "/api/v1/auth/logout", "/css/**", "/js/**").permitAll()

                        // Validação liberar apenas administradores para cadastrar novos usuários na aplicação
                        .requestMatchers(HttpMethod.POST, "/api/v1/users").hasRole("administrator")

                        // Validação para bloquear não administradores de acessar a página de cadastro de usuário
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
