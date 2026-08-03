/**
 * Tradução do perfil de acesso para o rótulo que vai à tela.
 *
 * Mora aqui, e não na página, porque duas telas mostram o mesmo perfil: a
 * listagem de usuários e o usuário logado na topbar. Um mapa por página faria
 * a mesma role aparecer com nome diferente em cada uma.
 */

/** Nome da role no banco → rótulo de tela. Semeadas na V2. */
const ROLE_LABELS = {
    administrator: "Administrador",
    employee: "Funcionário",
};

/**
 * Perfil desconhecido cai no nome cru: é melhor mostrar "supervisor" do que
 * esconder que existe um perfil novo que a tela ainda não traduz.
 */
export function roleLabel(roleName) {
    return ROLE_LABELS[roleName] ?? roleName;
}
