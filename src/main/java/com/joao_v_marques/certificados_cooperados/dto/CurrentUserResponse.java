package com.joao_v_marques.certificados_cooperados.dto;

/**
 * O usuário autenticado, do jeito que a topbar precisa exibir.
 *
 * Traz nome, e-mail e iniciais, que a topbar mostra, mais o perfil de acesso,
 * que ela não mostra: é o que permite à sidebar esconder os itens que o usuário
 * não poderia abrir. Continua sem id e sem situação — nada que a tela não use.
 *
 * O perfil aqui é conveniência de tela, nunca autorização: quem barra o acesso é
 * o SecurityConfig, no servidor. Esconder o item de menu só evita oferecer um
 * caminho que termina em 403.
 *
 * Devolver o próprio perfil ao próprio dono não vaza nada: é informação da conta
 * de quem já está autenticado.
 *
 * `name` já vem resolvido: quando o cadastro não tem nome preenchido, o backend
 * devolve o username, para a tela não precisar decidir isso.
 */
public record CurrentUserResponse(String name, String email, String initials, String role) {
}
