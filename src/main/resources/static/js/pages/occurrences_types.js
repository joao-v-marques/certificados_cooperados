/**
 * Página de tipos de ocorrência: lista os cadastrados e prepara os gestos de
 * cadastro, edição e mudança de situação.
 *
 * ATENÇÃO — primeira etapa, só o frontend. A única conversa com a API aqui é o
 * GET que preenche a tabela. Cadastrar, editar e desativar já abrem e fecham as
 * telas certas, mas ainda não gravam nada: os pontos de ligação estão marcados
 * com TODO, um para cada endpoint que falta.
 *
 * Contrato com o HTML (data-*):
 *   [data-type-form]          formulário de cadastro, submit interceptado
 *   [data-empty-state]        bloco de "nenhum tipo cadastrado"
 *   [data-table-count]        rodapé com a contagem da tabela
 *   [data-type-edit-modal]    <dialog> da edição
 *   [data-type-edit-form]     formulário dentro do modal de edição
 *   [data-edit-error]         recusa da edição que não é de campo
 *   [data-type-status-modal]  <dialog> da confirmação de desativar/reativar
 *   [data-status-title]       título, reescrito conforme a ação
 *   [data-status-question]    pergunta, reescrita conforme a ação
 *   [data-status-name]        nome do tipo em destaque
 *   [data-status-warning]     consequência da ação
 *   [data-status-confirm]     botão que confirma
 *   [data-status-error]       recusa da mudança de situação
 *   [data-modal-close]        qualquer botão que fecha o modal em que está
 *
 * Nas linhas da tabela:
 *   [data-edit-type="<id>"]    abre a edição
 *   [data-status-type="<id>"]  abre a confirmação de situação
 *
 * Por id: tbodyOccurrenceTypes, cardOccurrenceTypesQtd,
 * cardOccurrenceTypesActiveQtd, cardOccurrenceTypesInactiveQtd,
 * tipo-nome/erro-tipo-nome e edicao-tipo-nome/erro-edicao-tipo-nome.
 *
 * O retorno de sucesso e de erro sai em toast (ver utils/notyf.js); o que é
 * específico de um campo continua no <p class="field__error"> dele.
 */

import {dismissNotifications, notifyError, notifyInfo} from "../utils/notyf.js";

const API_URL = "/certificados-cooperados/api/v1/occurrence-types";

// Liga o campo que o backend devolve em `fields` aos elementos da tela. Cada
// formulário tem o seu mapa porque o cadastro e a edição usam o mesmo nome de
// campo (`name`) em inputs diferentes.
const FORM_FIELDS = {
    name: {inputId: "tipo-nome", errorId: "erro-tipo-nome"},
};

const EDIT_FIELDS = {
    name: {inputId: "edicao-tipo-nome", errorId: "erro-edicao-tipo-nome"},
};

/**
 * Último resultado do GET, guardado por id.
 *
 * Os modais são preenchidos a partir daqui, e não de uma nova chamada: a
 * listagem já traz nome e situação, que é tudo que as duas telas mostram.
 */
const typesById = new Map();

/* =========================================================================
   Erros de campo
   ========================================================================= */

// O nome do tipo é digitado pelo usuário e volta da API, então não pode ser
// interpolado cru em innerHTML.
function escapeHtml(value) {
    const characters = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"};
    return String(value ?? "").replace(/[&<>"']/g, character => characters[character]);
}

function clearFieldErrors(fieldMap) {
    Object.values(fieldMap).forEach(({inputId, errorId}) => {
        const errorElement = document.getElementById(errorId);

        document.getElementById(inputId).removeAttribute("aria-invalid");
        errorElement.textContent = "";
        errorElement.classList.add("is-hidden");
    });
}

// Recebe o mapa `fields` do ApiError e devolve o primeiro campo marcado, para
// levar o foco até ele.
function showFieldErrors(fieldMap, fields) {
    let firstInvalid = null;

    Object.entries(fields).forEach(([field, message]) => {
        const target = fieldMap[field];
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

// O erro geral dos modais: com o <dialog> aberto o toast fica atrás dele, então
// a recusa que não é de campo precisa aparecer dentro do próprio painel.
function showModalError(element, message) {
    element.textContent = message;
    element.classList.remove("is-hidden");
}

function clearModalError(element) {
    element.textContent = "";
    element.classList.add("is-hidden");
}

/* =========================================================================
   Listagem
   ========================================================================= */

/** Desenha uma linha da tabela a partir de um tipo da listagem. */
function buildRow(occurrenceType) {
    const row = document.createElement("tr");

    const isActive = occurrenceType.isActive;

    const badgeClass = isActive ? "badge--success" : "badge--negative";
    const badgeLabel = isActive ? "Ativo" : "Inativo";

    const nameClass = isActive ? "table__primary" : "table__primary types-table__name--inactive";

    // Um gesto só, com dois sentidos: desativa o que está ativo e reativa o que
    // está inativo. O ícone e o rótulo acompanham.
    const statusIcon = isActive
        ? `<path d="M8 2.5v6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
           <path d="M4.6 4.6a4.8 4.8 0 1 0 6.8 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`
        : `<path d="M13.5 8a5.5 5.5 0 1 1-1.9-4.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
           <path d="M13.5 2.5V6H10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`;

    const statusClass = isActive ? "types-table__action--danger" : "types-table__action--restore";
    const statusTitle = isActive ? "Desativar tipo" : "Reativar tipo";
    const statusLabel = isActive ? "Desativar o tipo" : "Reativar o tipo";

    row.innerHTML = `
        <td data-label="Tipo">
            <span class="${nameClass}">${escapeHtml(occurrenceType.name)}</span>
        </td>
        <td data-label="Situação">
            <span class="badge ${badgeClass}">${badgeLabel}</span>
        </td>
        <td class="table__actions">
            <button type="button" class="btn-icon types-table__action"
                    data-edit-type="${occurrenceType.id}" title="Editar tipo">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M9.5 3 13 6.5 5.5 14H2v-3.5L9.5 3Z" stroke="currentColor"
                          stroke-width="1.4" stroke-linejoin="round"/>
                </svg>
                <span class="visually-hidden">Editar o tipo ${escapeHtml(occurrenceType.name)}</span>
            </button>
            <button type="button" class="btn-icon types-table__action ${statusClass}"
                    data-status-type="${occurrenceType.id}" title="${statusTitle}">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    ${statusIcon}
                </svg>
                <span class="visually-hidden">${statusLabel} ${escapeHtml(occurrenceType.name)}</span>
            </button>
        </td>
    `;

    return row;
}

/** Acerta os três indicadores do topo com a lista que acabou de chegar. */
function updateSummary(occurrenceTypes) {
    const total = occurrenceTypes.length;
    const active = occurrenceTypes.filter(type => type.isActive).length;

    document.getElementById("cardOccurrenceTypesQtd").textContent = total;
    document.getElementById("cardOccurrenceTypesActiveQtd").textContent = active;
    document.getElementById("cardOccurrenceTypesInactiveQtd").textContent = total - active;
}

// Poular tabela de tipos de ocorrência cadastrados
async function populateOccurrenceTypesTable() {
    const tbodyOccurrenceTypes = document.getElementById("tbodyOccurrenceTypes");
    const emptyState = document.querySelector("[data-empty-state]");
    const tableCount = document.querySelector("[data-table-count]");

    tbodyOccurrenceTypes.innerHTML = ``;
    typesById.clear();

    const occurrenceTypesFragment = document.createDocumentFragment();

    try {
        const response = await fetch(API_URL, {credentials: "same-origin"});

        // Mesma regra das outras telas: sessão expirada volta para o login em
        // vez de virar "não foi possível carregar".
        if (response.status === 401) {
            window.location.href = "login";
            return;
        }

        if (!response.ok) {
            throw new Error(`A API respondeu ${response.status}`);
        }

        const responseJSON = await response.json();

        // A API devolve um array puro; a guarda evita quebrar caso isso mude.
        const rawTypes = Array.isArray(responseJSON) ? responseJSON : [];

        // TODO: hoje o GET /api/v1/occurrence-types devolve só os tipos ativos
        // (OccurrenceTypeService.findAllActiveTypes) e o OccurrenceTypeResponse
        // não tem o campo isActive — por isso o `?? true`. Esta tela é de
        // configuração e precisa enxergar os desativados para poder reativá-los:
        // quando o endpoint passar a devolver todos, com a situação de cada um,
        // a coluna e os indicadores já funcionam sem mexer aqui.
        const occurrenceTypes = rawTypes.map(type => ({
            id: type.id,
            name: type.name,
            isActive: type.isActive ?? true,
        }));

        occurrenceTypes.forEach(occurrenceType => {
            typesById.set(String(occurrenceType.id), occurrenceType);
            occurrenceTypesFragment.appendChild(buildRow(occurrenceType));
        });

        tbodyOccurrenceTypes.appendChild(occurrenceTypesFragment);
        updateSummary(occurrenceTypes);

        tableCount.textContent = occurrenceTypes.length === 1
            ? "1 tipo de ocorrência cadastrado"
            : `${occurrenceTypes.length} tipos de ocorrência cadastrados`;

        // Só agora, com a resposta em mãos, dá para afirmar que não há tipo
        // nenhum: tem alguém na lista, esconde o bloco; lista vazia, revela.
        emptyState.hidden = occurrenceTypes.length > 0;
    } catch (error) {
        // Falha de rede não é "nenhum tipo cadastrado" — o bloco continua oculto
        // para não mentir sobre o estado do cadastro.
        emptyState.hidden = true;
        tableCount.textContent = "";

        notifyError("Não foi possível carregar os tipos de ocorrência. Atualize a página.");
        console.error(error);
    }
}

/* =========================================================================
   Modais

   Abertura e fechamento são do <dialog> nativo: showModal() já prende o foco
   dentro do painel, torna o resto da página inerte e faz o Esc fechar.
   ========================================================================= */

/** Liga todo [data-modal-close] ao <dialog> em que ele está. */
function initModalClosers() {
    document.querySelectorAll("[data-modal-close]").forEach(button => {
        button.addEventListener("click", () => button.closest("dialog")?.close());
    });
}

/* -------------------------------------------------------------------------
   Edição
   ------------------------------------------------------------------------- */

function openEditModal(occurrenceType) {
    const modal = document.querySelector("[data-type-edit-modal]");
    const input = document.getElementById("edicao-tipo-nome");

    clearFieldErrors(EDIT_FIELDS);
    clearModalError(document.querySelector("[data-edit-error]"));

    // Guardado no formulário para o submit saber qual tipo está sendo editado
    // sem depender de qual linha foi clicada por último.
    document.querySelector("[data-type-edit-form]").dataset.typeId = String(occurrenceType.id);
    input.value = occurrenceType.name;

    modal.showModal();
    input.focus();
    input.select();
}

function handleEditSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const errorElement = document.querySelector("[data-edit-error]");

    clearFieldErrors(EDIT_FIELDS);
    clearModalError(errorElement);

    const name = document.getElementById("edicao-tipo-nome").value.trim();

    // Validação de campo obrigatório fica aqui mesmo depois que o PUT existir:
    // é o que evita uma ida ao servidor para ouvir de volta "o nome é
    // obrigatório". O resto da recusa continua sendo do backend.
    if (!name) {
        showFieldErrors(EDIT_FIELDS, {name: "Informe o nome do tipo de ocorrência."});
        return;
    }

    // TODO: trocar pelo PUT /api/v1/occurrence-types/{id} com {name}. O retorno
    // segue o ApiError das outras telas: `fields` preenchido na validação das
    // anotações (showFieldErrors) e vazio quando é regra de negócio, como nome
    // repetido (showModalError). Fechado o modal, recarregar a tabela com
    // populateOccurrenceTypesTable().
    showModalError(errorElement, "A edição ainda não está ligada ao servidor.");
    console.info("PUT pendente", {id: form.dataset.typeId, name});
}

function initEditModal() {
    const form = document.querySelector("[data-type-edit-form]");
    if (!form) return;

    form.addEventListener("submit", handleEditSubmit);
}

/* -------------------------------------------------------------------------
   Situação (desativar / reativar)

   O mesmo modal serve para as duas ações: os textos são reescritos a cada
   abertura, porque desativar e reativar têm consequências opostas e um texto
   neutro não avisaria nada.
   ------------------------------------------------------------------------- */

function openStatusModal(occurrenceType) {
    const modal = document.querySelector("[data-type-status-modal]");
    const confirmButton = document.querySelector("[data-status-confirm]");
    const isActive = occurrenceType.isActive;

    clearModalError(document.querySelector("[data-status-error]"));

    document.querySelector("[data-status-title]").textContent =
        isActive ? "Desativar tipo de ocorrência" : "Reativar tipo de ocorrência";

    document.querySelector("[data-status-question]").textContent =
        isActive
            ? "Tem certeza que deseja desativar este tipo de ocorrência?"
            : "Tem certeza que deseja reativar este tipo de ocorrência?";

    // textContent, e não innerHTML: o nome vem do cadastro e não pode ser
    // interpretado como marcação.
    document.querySelector("[data-status-name]").textContent = occurrenceType.name;

    document.querySelector("[data-status-warning]").textContent =
        isActive
            ? "Ele deixa de aparecer na lista de tipos do lançamento, mas as ocorrências já lançadas com este tipo continuam no histórico dos cooperados. Dá para reativar depois."
            : "Ele volta a aparecer na lista de tipos do lançamento e pode ser usado em novas ocorrências.";

    confirmButton.textContent = isActive ? "Desativar tipo" : "Reativar tipo";
    confirmButton.classList.toggle("btn--danger", isActive);
    confirmButton.classList.toggle("btn--primary", !isActive);

    confirmButton.dataset.typeId = String(occurrenceType.id);

    modal.showModal();
    confirmButton.focus();
}

function handleStatusConfirm(event) {
    const confirmButton = event.currentTarget;
    const errorElement = document.querySelector("[data-status-error]");
    const occurrenceType = typesById.get(confirmButton.dataset.typeId);

    clearModalError(errorElement);

    // TODO: trocar pela chamada que grava a situação — PATCH
    // /api/v1/occurrence-types/{id}/situacao, ou DELETE para o desativar e PATCH
    // para o reativar, conforme ficar definido no controller. É soft delete:
    // occurrences.occurrence_type_id é FK obrigatória (V5), então o registro
    // nunca sai da tabela, só muda is_active. Confirmado, fechar o modal e
    // recarregar a tabela com populateOccurrenceTypesTable().
    showModalError(errorElement, "A mudança de situação ainda não está ligada ao servidor.");
    console.info("Mudança de situação pendente", {
        id: confirmButton.dataset.typeId,
        isActive: occurrenceType?.isActive,
    });
}

function initStatusModal() {
    const confirmButton = document.querySelector("[data-status-confirm]");
    if (!confirmButton) return;

    confirmButton.addEventListener("click", handleStatusConfirm);
}

/* -------------------------------------------------------------------------
   Ações da linha

   Um listener só no <tbody>, e não um por botão: as linhas são redesenhadas a
   cada recarga da tabela, e ligar botão a botão exigiria refazer tudo junto.
   ------------------------------------------------------------------------- */

function initRowActions() {
    const tbody = document.getElementById("tbodyOccurrenceTypes");
    if (!tbody) return;

    tbody.addEventListener("click", event => {
        const editButton = event.target.closest("[data-edit-type]");
        if (editButton) {
            const occurrenceType = typesById.get(editButton.dataset.editType);
            if (occurrenceType) openEditModal(occurrenceType);
            return;
        }

        const statusButton = event.target.closest("[data-status-type]");
        if (statusButton) {
            const occurrenceType = typesById.get(statusButton.dataset.statusType);
            if (occurrenceType) openStatusModal(occurrenceType);
        }
    });
}

/* =========================================================================
   Cadastro
   ========================================================================= */

function handleSubmit(event) {
    event.preventDefault();

    // Os toasts do envio anterior saem da tela: o que vale é o resultado deste.
    dismissNotifications();
    clearFieldErrors(FORM_FIELDS);

    const name = document.getElementById("tipo-nome").value.trim();

    // Mesma razão da edição: o campo obrigatório é barrado aqui, o resto é do
    // backend.
    if (!name) {
        const firstInvalid = showFieldErrors(FORM_FIELDS, {name: "Informe o nome do tipo de ocorrência."});
        firstInvalid?.focus();
        return;
    }

    // TODO: trocar pelo POST /api/v1/occurrence-types com {name}, no mesmo
    // formato do cadastro de cooperados: 401 volta para o login, ApiError vira
    // toast mais erro de campo, e o 201 limpa o formulário (form.reset() antes
    // do notifySuccess, porque o reset derruba os toasts) e recarrega a tabela.
    notifyInfo("O cadastro de tipo de ocorrência ainda não está ligado ao servidor.");
    console.info("POST pendente", {name});
}

function initTypeForm() {
    const form = document.querySelector("[data-type-form]");
    if (!form) return;

    form.addEventListener("submit", handleSubmit);

    // "Limpar campos" também zera o que sobrou do envio anterior.
    form.addEventListener("reset", () => {
        dismissNotifications();
        clearFieldErrors(FORM_FIELDS);
    });
}

/* =========================================================================
   Ligação
   ========================================================================= */

function init() {
    initTypeForm();
    initModalClosers();
    initEditModal();
    initStatusModal();
    initRowActions();
    populateOccurrenceTypesTable();
}

// Rodar tudo
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init(); // DOM já está pronto para rodar
}
