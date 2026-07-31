package com.joao_v_marques.certificados_cooperados.security;

import com.joao_v_marques.certificados_cooperados.exception.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;

/**
 * Autenticado, mas sem o perfil que a rota exige.
 *
 * É o par do {@link RestAuthenticationEntryPoint}, que cuida do 401, e separa os
 * dois públicos do mesmo jeito que ele:
 *
 *   - rota de API devolve 403 com {@link ApiError}, o formato que o resto da API
 *     usa. Sem isso o 403 sairia como página de erro do container, e a tela
 *     receberia HTML onde espera JSON;
 *   - rota de página manda o usuário para a home. Devolver 403 cru deixaria a
 *     tela em branco, e mandar para o login seria mentira: ele está autenticado,
 *     o que falta é permissão, e entrar de novo não resolveria.
 */
public class RestAccessDeniedHandler implements AccessDeniedHandler {

    /** Código lido por js/pages/home.js, que o traduz no toast de recusa. */
    private static final String NO_ACCESS = "sem-acesso";

    private final ObjectMapper objectMapper;

    public RestAccessDeniedHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void handle(HttpServletRequest request,
                       HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException {

        if (request.getServletPath().startsWith("/api/")) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");

            // A mensagem não diz qual perfil falta: quem não pode agir também
            // não precisa saber o desenho de permissões para tentar de novo.
            objectMapper.writeValue(response.getWriter(),
                    ApiError.of("Você não tem permissão para executar esta ação."));
            return;
        }

        // Mesma escolha do RestAuthenticationEntryPoint: a aplicação é stateless,
        // então não há flash attribute e o motivo viaja como código fixo na query
        // string. Código fixo, e nunca texto vindo do cliente, para nada do que
        // foi pedido acabar refletido na página.
        response.sendRedirect(request.getContextPath() + "/home?erro=" + NO_ACCESS);
    }
}
