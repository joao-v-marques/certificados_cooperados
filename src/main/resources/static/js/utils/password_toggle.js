/**
 * Botão do olho que mostra e esconde a senha digitada.
 *
 * Contrato no HTML:
 *   [data-password-toggle]        botão, com aria-pressed e aria-controls
 *                                 apontando para o id do <input type="password">
 *   .icon-eye / .icon-eye-off     os dois ícones dentro do botão; a troca é
 *                                 feita pela classe is-hidden
 *   [data-password-toggle-label]  texto do leitor de tela, dentro do botão
 *
 * Mora em utils porque mais de uma tela usa: o login e o cadastro de usuários.
 */

export function initPasswordToggles() {
    document.querySelectorAll('[data-password-toggle]').forEach((toggle) => {
        const field = document.getElementById(toggle.getAttribute('aria-controls'));
        if (!field) return;

        const iconShow = toggle.querySelector('.icon-eye');
        const iconHide = toggle.querySelector('.icon-eye-off');
        const label = toggle.querySelector('[data-password-toggle-label]');

        toggle.addEventListener('click', () => {
            const willShow = field.type === 'password';

            field.type = willShow ? 'text' : 'password';
            toggle.setAttribute('aria-pressed', String(willShow));

            iconShow?.classList.toggle('is-hidden', willShow);
            iconHide?.classList.toggle('is-hidden', !willShow);
            if (label) label.textContent = willShow ? 'Ocultar a senha' : 'Mostrar a senha';

            // O cursor volta para o campo, no fim do que já foi digitado.
            const end = field.value.length;
            field.focus();
            try {
                field.setSelectionRange(end, end);
            } catch {
                // alguns navegadores recusam setSelectionRange em type="password"
            }
        });
    });
}
