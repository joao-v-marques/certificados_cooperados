/**
 * login.js — comportamento da tela de entrada.
 *
 * Escopo: apenas o botão de mostrar/ocultar a senha.
 * A validação dos campos obrigatórios fica com o próprio navegador (atributo
 * required no HTML) e, depois, com o backend. Nenhuma chamada de rede aqui.
 *
 * Contrato no HTML:
 *   [data-password-toggle]                  botão com aria-pressed
 *     aria-controls="<id do input>"         campo que ele comanda
 *     .icon-eye / .icon-eye-off             ícones alternados por is-hidden
 *     [data-password-toggle-label]          texto lido por leitor de tela
 */

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
