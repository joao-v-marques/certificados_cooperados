/**
 * Página de usuários: lista os cadastrados e envia o formulário de cadastro.
 *
 * Contrato com o HTML (data-*):
 *   [data-user-form]    formulário de cadastro, submit interceptado
 *   [data-empty-state]  bloco de "nenhum usuário cadastrado"
 *   [data-table-count]  rodapé com a contagem de linhas
 *
 * Por id: tbodyUsers, cardUsersQtd, e os pares campo/erro listados em FIELDS.
 *
 * O retorno de sucesso e de erro sai em toast (ver utils/notyf.js); o que é
 * específico de um campo continua no <p class="field__error"> dele.
 *
 * A senha nunca é relida da tela depois do envio: o form.reset() do sucesso
 * limpa os dois campos, e nada aqui guarda o valor digitado.
 */

import {dismissNotifications, notifyError, notifySuccess} from "../utils/notyf.js";
import {initPasswordToggles} from "../utils/password_toggle.js";
import {roleLabel} from "../utils/roles.js";

const API_URL = "/certificados-cooperados/api/v1/users";

/**
 * Liga o campo que o backend devolve em `fields` aos elementos da tela.
 *
 * As chaves são as do UserRequest. A confirmação de senha entra junto mesmo não
 * existindo no backend: ela é conferida aqui, e reaproveitar o mesmo mecanismo
 * evita um caminho separado só para mostrar um erro.
 */
const FIELDS = {
    name: {inputId: "usuario-nome", errorId: "erro-nome"},
    username: {inputId: "usuario-username", errorId: "erro-username"},
    email: {inputId: "usuario-email", errorId: "erro-email"},
    password: {inputId: "usuario-senha", errorId: "erro-senha"},
    passwordConfirmation: {inputId: "usuario-senha-confirmacao", errorId: "erro-senha-confirmacao"},
    roleId: {inputId: "usuario-perfil", errorId: "erro-perfil"},
};

/* =========================================================================
   Texto
   ========================================================================= */

// Nome, username e email são digitados pelo usuário e voltam da API, então não
// podem ser interpolados crus em innerHTML.
function escapeHtml(value) {
    const characters = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"};
    return String(value ?? "").replace(/[&<>"']/g, character => characters[character]);
}

// O createdAt chega como instante ISO; na tabela só interessa o dia.
function formatDate(value) {
    // Ausência sai antes da conversão: new Date(null) não dá data inválida, dá
    // a época — a célula mostraria 31/12/1969 em vez de admitir que não sabe.
    if (!value) return "—";

    const date = new Date(value);

    // Data que o navegador não entendeu vira traço, e não "Invalid Date".
    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("pt-BR");
}

/* =========================================================================
   Erros de campo
   ========================================================================= */

function clearFieldErrors() {
    Object.values(FIELDS).forEach(({inputId, errorId}) => {
        const errorElement = document.getElementById(errorId);

        document.getElementById(inputId).removeAttribute("aria-invalid");
        errorElement.textContent = "";
        errorElement.classList.add("is-hidden");
    });
}

// Recebe o mapa `fields` do ApiError e devolve o primeiro campo marcado, para
// levar o foco até ele.
function showFieldErrors(fields) {
    let firstInvalid = null;

    Object.entries(fields).forEach(([field, message]) => {
        const target = FIELDS[field];
        if (!target) return;

        const input = document.getElementById(target.inputId);
        const errorElement = document.getElementById(target.errorId);

        input.setAttribute("aria-invalid", "true");
        errorElement.textContent = message;
        errorElement.classList.remove("is-hidden");

        if (!firstInvalid) firstInvalid = input;
    });

    return firstInvalid;
}

/* =========================================================================
   Listagem
   ========================================================================= */

function renderCount(total) {
    const counter = document.querySelector("[data-table-count]");

    counter.textContent = (total === 1)
        ? "1 usuário cadastrado"
        : `${total} usuários cadastrados`;
}

async function populateUsersTable() {
    const tbodyUsers = document.getElementById("tbodyUsers");
    const emptyState = document.querySelector("[data-empty-state]");

    tbodyUsers.innerHTML = ``;

    const usersFragment = document.createDocumentFragment();

    try {
        const response = await fetch(API_URL, {credentials: "same-origin"});

        // Mesma regra do cadastro: sessão expirada volta para o login em vez de
        // virar "não foi possível carregar".
        if (response.status === 401) {
            window.location.href = "login";
            return;
        }

        if (!response.ok) {
            throw new Error(`A API respondeu ${response.status}`);
        }

        const responseJSON = await response.json();

        // A API devolve um array puro; a guarda evita quebrar caso isso mude.
        const users = Array.isArray(responseJSON) ? responseJSON : [];

        users.forEach(user => {
            const badgeClass = user.isActive ? "badge--success" : "badge--negative";
            const badgeLabel = user.isActive ? "Ativo" : "Inativo";

            const trUser = document.createElement("tr");

            // O nome e o email são opcionais no cadastro: sem nome, o username
            // sobe para a linha principal em vez de deixar a célula vazia.
            const primary = user.name ?? user.username;
            const secondary = user.name ? user.username : "";

            trUser.innerHTML = `
                <td data-label="Usuário">
                    <span class="table__primary">${escapeHtml(primary)}</span>
                    <span class="table__secondary">${escapeHtml(secondary)}</span>
                </td>
                <td data-label="E-mail">${escapeHtml(user.email)}</td>
                <td data-label="Perfil">
                    <span class="badge badge--neutral">${escapeHtml(roleLabel(user.roleName))}</span>
                </td>
                <td data-label="Cadastrado em" class="tabular">${escapeHtml(formatDate(user.createdAt))}</td>
                <td data-label="Situação">
                    <span class="badge ${badgeClass}">${badgeLabel}</span>
                </td>
            `;

            usersFragment.appendChild(trUser);
        });

        document.getElementById("cardUsersQtd").textContent = users.length;

        tbodyUsers.appendChild(usersFragment);
        renderCount(users.length);

        // Só agora, com a resposta em mãos, dá para afirmar que não há usuário:
        // tem alguém na lista, esconde o bloco; lista vazia, revela.
        emptyState.hidden = users.length > 0;
    } catch (error) {
        // Falha de rede não é "nenhum usuário cadastrado" — o bloco continua
        // oculto para não mentir sobre o estado do cadastro.
        emptyState.hidden = true;

        notifyError("Não foi possível carregar a lista de usuários. Atualize a página.");
        console.error(error);
    }
}

/* =========================================================================
   Cadastro (POST)
   ========================================================================= */

function readForm() {
    return {
        username: document.getElementById("usuario-username").value.trim(),
        // Campos opcionais: em branco o backend grava null
        name: document.getElementById("usuario-nome").value.trim(),
        email: document.getElementById("usuario-email").value.trim(),
        // A senha vai como foi digitada: espaço nas pontas é caractere válido
        // dela, e cortar aqui deixaria o usuário sem conseguir entrar depois.
        password: document.getElementById("usuario-senha").value,
        roleId: Number(document.getElementById("usuario-perfil").value),
    };
}

/**
 * Confere a senha contra a confirmação, antes de enviar.
 *
 * A confirmação é só da tela — o backend nem recebe o campo, porque não teria o
 * que fazer com ele: quem digitou errado precisa saber disso aqui, e não depois
 * de gravar uma senha que ninguém sabe qual é.
 */
function passwordsMatch() {
    const password = document.getElementById("usuario-senha").value;
    const confirmation = document.getElementById("usuario-senha-confirmacao").value;

    if (password === confirmation) return true;

    const firstInvalid = showFieldErrors({
        passwordConfirmation: "A confirmação não confere com a senha digitada.",
    });

    notifyError("A senha e a confirmação não são iguais.");
    firstInvalid?.focus();

    return false;
}

async function postUser(payload) {
    return fetch(API_URL, {
        method: "POST",
        credentials: "same-origin",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
    });
}

// Traduz o ApiError da recusa em mensagens na tela. O corpo é sempre
// {message, fields}: `fields` vem preenchido na validação das anotações e vazio
// quando é regra de negócio (usuário repetido, perfil inexistente) ou falta de
// permissão.
function handleErrorResponse(apiError) {
    const message = apiError?.message || "Não foi possível cadastrar o usuário. Tente de novo.";
    const fields = apiError?.fields ?? {};

    notifyError(message);

    const firstInvalid = showFieldErrors(fields);
    if (firstInvalid) firstInvalid.focus();
}

async function handleSubmit(event) {
    event.preventDefault();

    // Os toasts do envio anterior saem da tela: o que vale é o resultado deste.
    dismissNotifications();
    clearFieldErrors();

    if (!passwordsMatch()) return;

    // Guardado agora: depois do primeiro await o event.currentTarget já é null,
    // porque o disparo do evento terminou.
    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
        const response = await postUser(readForm());

        // Sessão expirada no meio do cadastro: o entryPoint responde 401 e a
        // página de login mostra o aviso.
        if (response.status === 401) {
            window.location.href = "login";
            return;
        }

        const body = await response.json().catch(() => null);

        if (!response.ok) {
            handleErrorResponse(body);
            return;
        }

        // Limpar antes de avisar: reset() dispara o evento de reset, que derruba
        // os toasts — na ordem inversa o sucesso apareceria e sumiria na hora.
        // O reset é também o que apaga a senha digitada da tela.
        form.reset();
        notifySuccess(`${body?.username ?? "O usuário"} já pode entrar na aplicação.`);

        // A lista só é recarregada depois do 201, para não mostrar um usuário
        // que o backend recusou.
        await populateUsersTable();
    } catch (error) {
        notifyError("Não foi possível conectar ao servidor. Tente de novo.");
        console.error(error);
    } finally {
        submitButton.disabled = false;
    }
}

function initUserForm() {
    const form = document.querySelector("[data-user-form]");
    if (!form) return;

    form.addEventListener("submit", handleSubmit);

    // "Limpar campos" também zera o que sobrou do envio anterior.
    form.addEventListener("reset", () => {
        dismissNotifications();
        clearFieldErrors();
    });
}

/* =========================================================================
   Ligação
   ========================================================================= */

function init() {
    initPasswordToggles();
    initUserForm();
    populateUsersTable();
}

// Rodar tudo
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init(); // DOM já está pronto para rodar
}
