/**
 * Toasts de retorno (Notyf).
 *
 * Ponto único de retorno visual da aplicação: em vez de cada página revelar seu
 * próprio bloco `.alert`, todas chamam as funções daqui. O erro de campo
 * continua no `<p class="field__error">` do formulário — o toast diz o que
 * aconteceu, o campo diz onde corrigir.
 *
 * A tela de login é a exceção combinada: lá o aviso segue fixo dentro do
 * cartão, porque a página também precisa mostrar o motivo que o servidor manda
 * na própria URL (sessão expirada, login necessário).
 *
 * Uso:
 *   import {notifySuccess, notifyError} from "../utils/notyf.js";
 *   notifySuccess("Cooperado cadastrado.");
 *
 * A aparência mora em `css/notyf.css` (só tokens, nenhum hexadecimal), e a
 * biblioteca vem servida pela própria aplicação em `js/vendor/notyf/` — nada de
 * CDN, porque a mensagem de erro não pode depender de acesso externo. Ela fica
 * debaixo de `js/` de propósito: é o prefixo que o SecurityConfig libera sem
 * autenticação.
 */

import {Notyf} from "../vendor/notyf/notyf.es.js";

/* =========================================================================
   Ícones
   Mesmos desenhos usados em `.alert__icon`, para que o toast e o aviso na
   página não pareçam de aplicações diferentes. `currentColor` deixa a cor
   por conta do CSS.
   ========================================================================= */

const ICON_SUCCESS = `
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.5"/>
      <path d="m5.25 8.25 1.9 1.9 3.6-4.3" stroke="currentColor" stroke-width="1.5"
            stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

const ICON_ERROR = `
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.5"/>
      <path d="M8 4.75v3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="8" cy="11" r="0.85" fill="currentColor"/>
    </svg>`;

const ICON_WARNING = `
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2.4 14.2 13H1.8L8 2.4Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M8 6.5v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="8" cy="11.4" r="0.85" fill="currentColor"/>
    </svg>`;

const ICON_INFO = `
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.5"/>
      <path d="M8 7.5v3.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="8" cy="5" r="0.85" fill="currentColor"/>
    </svg>`;

/* =========================================================================
   Configuração
   ========================================================================= */

// Erro fica mais tempo na tela do que sucesso: sucesso só confirma o que o
// usuário acabou de fazer, erro precisa ser lido até o fim.
const DURATION_SUCCESS = 4000;
const DURATION_ERROR = 7000;
const DURATION_WARNING = 6000;
const DURATION_INFO = 5000;

// `backgroundColor: ""` derruba a cor embutida na biblioteca. Sem cor, o Notyf
// também não injeta o efeito de onda (`ripple`), e o visual fica inteiro por
// conta de css/notyf.css — que é o único jeito de manter tudo em tokens.
function buildType(type, icon, duration) {
    return {
        type,
        className: `notyf__toast--${type}`,
        backgroundColor: "",
        duration,
        icon,
    };
}

const notyf = new Notyf({
    duration: DURATION_INFO,
    ripple: false,
    dismissible: true,
    // Canto inferior direito: não cobre a topbar nem o menu da conta.
    position: {x: "right", y: "bottom"},
    types: [
        buildType("success", ICON_SUCCESS, DURATION_SUCCESS),
        buildType("error", ICON_ERROR, DURATION_ERROR),
        buildType("warning", ICON_WARNING, DURATION_WARNING),
        buildType("info", ICON_INFO, DURATION_INFO),
    ],
});

/* =========================================================================
   API
   ========================================================================= */

// A mensagem quase sempre vem da API, então pode chegar vazia ou nula. Um toast
// em branco é pior do que um texto genérico.
function open(type, message, fallback) {
    const text = String(message ?? "").trim() || fallback;
    const notification = notyf.open({type, message: text});

    labelLastDismissButton();

    return notification;
}

// O Notyf cria o botão de fechar sem texto nenhum, o que deixa um botão sem
// nome para o leitor de tela. Como ele não devolve o nó, o jeito é pegar o
// último recém-criado — a renderização é síncrona, então é sempre este.
function labelLastDismissButton() {
    const buttons = document.querySelectorAll(".notyf__dismiss-btn");
    const button = buttons[buttons.length - 1];
    if (!button) return;

    button.type = "button";
    button.setAttribute("aria-label", "Fechar aviso");
}

/** Confirma uma ação que deu certo (cadastro salvo, curso lançado). */
export function notifySuccess(message) {
    return open("success", message, "Pronto.");
}

/** Recusa ou falha: erro de validação, regra de negócio, servidor fora do ar. */
export function notifyError(message) {
    return open("error", message, "Não foi possível concluir. Tente de novo.");
}

/** Deu certo, mas com ressalva — ou algo que o usuário precisa conferir. */
export function notifyWarning(message) {
    return open("warning", message, "Confira as informações e tente de novo.");
}

/** Recado neutro, sem sucesso nem falha. */
export function notifyInfo(message) {
    return open("info", message, "Aviso.");
}

/** Limpa a tela de uma vez, por exemplo antes de reenviar um formulário. */
export function dismissNotifications() {
    notyf.dismissAll();
}
