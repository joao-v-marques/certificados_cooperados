/**
 * Página de cooperados: lista os cadastrados e envia o formulário de cadastro.
 *
 * Contrato com o HTML (data-*):
 *   [data-member-form]         formulário de cadastro, submit interceptado
 *   [data-alert-success]       aviso de cadastro aceito
 *   [data-alert-success-text]  parágrafo do aviso de sucesso
 *   [data-alert-danger]        aviso de cadastro recusado
 *   [data-alert-danger-text]   parágrafo do aviso de erro
 *   [data-empty-state]         bloco de "nenhum cooperado cadastrado"
 *
 * Por id: tbodyCooperativeMembers, cardCooperativeMembersQtd,
 * cooperado-nome/erro-nome e cooperado-email/erro-email.
 */

const API_URL = "/certificados-cooperados/api/v1/cooperative-members";

// Liga o campo que o backend devolve em `fields` aos elementos da tela.
const FIELDS = {
    name: {inputId: "cooperado-nome", errorId: "erro-nome"},
    email: {inputId: "cooperado-email", errorId: "erro-email"},
};

/* =========================================================================
   Avisos e erros de campo
   ========================================================================= */

// O nome do cooperado é digitado pelo usuário e volta da API, então não pode
// ser interpolado cru em innerHTML.
function escapeHtml(value) {
    const characters = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"};
    return String(value ?? "").replace(/[&<>"']/g, character => characters[character]);
}

function hideAlerts() {
    document.querySelector("[data-alert-success]").hidden = true;
    document.querySelector("[data-alert-danger]").hidden = true;
}

function showSuccessAlert(name) {
    const alertBox = document.querySelector("[data-alert-success]");
    const text = alertBox.querySelector("[data-alert-success-text]");

    text.textContent = `${name} já pode receber lançamento de curso.`;
    alertBox.hidden = false;
}

function showErrorAlert(message) {
    const alertBox = document.querySelector("[data-alert-danger]");
    const text = alertBox.querySelector("[data-alert-danger-text]");

    text.textContent = message;
    alertBox.hidden = false;
}

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

// Poular tabela de cooperados cadastrados
async function populateCooperativeMembersTable() {
    const tbodyCooperativeMembers = document.getElementById("tbodyCooperativeMembers");
    const emptyState = document.querySelector("[data-empty-state]");

    tbodyCooperativeMembers.innerHTML = ``;

    const cooperativeMembersFragment = document.createDocumentFragment();

    let cooperativeMembersQtd = 0;

    try {
        const response = await fetch(API_URL);

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
        const cooperativeMembers = Array.isArray(responseJSON) ? responseJSON : [];

        cooperativeMembers.forEach(cooperativeMember => {
            cooperativeMembersQtd++;

            const isActive = cooperativeMember.isActive;

            const badgeClass = isActive ? "badge--success" : "badge--negative";
            const badgeLabel = isActive ? "Ativo" : "Inativo";

            const trCooperativeMembers = document.createElement("tr");

            // O email é opcional: sem ele a segunda linha do nome fica vazia.
            trCooperativeMembers.innerHTML = `
                <td data-label="Cooperado">
                    <span class="table__primary">${escapeHtml(cooperativeMember.name)}</span>
                    <span class="table__secondary">${escapeHtml(cooperativeMember.email)}</span>
                </td>
                <td data-label="Cadastrado em" class="tabular">${escapeHtml(cooperativeMember.createdAt)}</td>
                <td data-label="Situação">
                    <span class="badge ${badgeClass}">${badgeLabel}</span>
                </td>
            `;

            cooperativeMembersFragment.appendChild(trCooperativeMembers);
        });

        const cooperativeMembersCard = document.getElementById("cardCooperativeMembersQtd");
        cooperativeMembersCard.innerText = cooperativeMembersQtd;

        tbodyCooperativeMembers.appendChild(cooperativeMembersFragment);

        // Só agora, com a resposta em mãos, dá para afirmar que não há cooperado:
        // tem alguém na lista, esconde o bloco; lista vazia, revela.
        emptyState.hidden = cooperativeMembers.length > 0;
    } catch (error) {
        // Falha de rede não é "nenhum cooperado cadastrado" — o bloco continua
        // oculto para não mentir sobre o estado do cadastro.
        emptyState.hidden = true;

        showErrorAlert("Não foi possível carregar a lista de cooperados. Atualize a página.");
        console.error(error);
    }
}

/* =========================================================================
   Cadastro (POST)
   ========================================================================= */

function readForm() {
    return {
        name: document.getElementById("cooperado-nome").value.trim(),
        // Campo opcional: em branco o backend grava null
        email: document.getElementById("cooperado-email").value.trim(),
    };
}

async function postCooperativeMember(payload) {
    return fetch(API_URL, {
        method: "POST",
        credentials: "same-origin",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
    });
}

// Traduz o ApiError da recusa em mensagens na tela. O corpo é sempre
// {message, fields}: `fields` vem preenchido na validação das anotações e
// vazio quando é regra de negócio (nome ou email repetido).
function handleErrorResponse(apiError) {
    const message = apiError?.message || "Não foi possível cadastrar o cooperado. Tente de novo.";
    const fields = apiError?.fields ?? {};

    showErrorAlert(message);

    const firstInvalid = showFieldErrors(fields);
    if (firstInvalid) firstInvalid.focus();
}

async function handleSubmit(event) {
    event.preventDefault();

    hideAlerts();
    clearFieldErrors();

    // Guardado agora: depois do primeiro await o event.currentTarget já é null,
    // porque o disparo do evento terminou.
    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
        const response = await postCooperativeMember(readForm());

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

        // Limpar antes de avisar: reset() dispara o evento de reset, que esconde
        // os avisos — na ordem inversa o sucesso apareceria e sumiria na hora.
        form.reset();
        showSuccessAlert(body?.name ?? "O cooperado");

        // A lista só é recarregada depois do 201, para não mostrar um cooperado
        // que o backend recusou.
        await populateCooperativeMembersTable();
    } catch (error) {
        showErrorAlert("Não foi possível conectar ao servidor. Tente de novo.");
        console.error(error);
    } finally {
        submitButton.disabled = false;
    }
}

function initCooperativeMemberForm() {
    const form = document.querySelector("[data-member-form]");
    if (!form) return;

    form.addEventListener("submit", handleSubmit);

    // "Limpar campos" também zera o que sobrou do envio anterior.
    form.addEventListener("reset", () => {
        hideAlerts();
        clearFieldErrors();
    });
}

/* =========================================================================
   Ligação
   ========================================================================= */

function init() {
    initCooperativeMemberForm();
    populateCooperativeMembersTable();
}

// Rodar tudo
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init(); // DOM já está pronto para rodar
}
