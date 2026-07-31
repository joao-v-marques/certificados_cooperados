package com.joao_v_marques.certificados_cooperados.dto;

/**
 * O usuário autenticado, do jeito que a topbar precisa exibir.
 *
 * Traz só o que é público na tela — nome, e-mail e iniciais. Nada de id, papel
 * ou situação: esta resposta é lida por qualquer página, então não carrega
 * informação que a tela não vai mostrar.
 *
 * `name` já vem resolvido: quando o cadastro não tem nome preenchido, o backend
 * devolve o username, para a tela não precisar decidir isso.
 */
public record CurrentUserResponse(String name, String email, String initials) {
}
