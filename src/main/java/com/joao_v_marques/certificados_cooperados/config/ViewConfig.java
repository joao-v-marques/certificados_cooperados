package com.joao_v_marques.certificados_cooperados.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class ViewConfig implements WebMvcConfigurer {
    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/home").setViewName("home");
        registry.addViewController("/login").setViewName("login");
        registry.addViewController("/novo-curso").setViewName("new_course");
        registry.addViewController("/painel-controle").setViewName("dashboard_control");
        registry.addViewController("/cooperados").setViewName("cooperative_members");
        registry.addViewController("/usuarios").setViewName("users");
        registry.addViewController("/nova-ocorrencia").setViewName("new_occurrence");
        registry.addViewController("/dashboard-ocorrencias").setViewName("occurrences_dashboard");
    }
}
