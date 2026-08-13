/**
 * Página de tipos de ocorrência: lista, cadastra, edita e ativa/desativa.
 *
 * Endpoints (todos sob o context-path da aplicação):
 *   GET    /api/v1/occurrence-types/all   lista com ativos e inativos, ordenada
 *                                         por nome — é a desta tela
 *   POST   /api/v1/occurrence-types       {name}      → 201 + o tipo criado
 *   PUT    /api/v1/occurrence-types/{id}  {name}      → 200 + o tipo atualizado
 *   DELETE /api/v1/occurrence-types/{id}  {isActive}  → 200 + o tipo atualizado
 *
 * O DELETE é soft: ele não apaga, grava `is_active`. Por isso serve tanto para
 * desativar (`false`) quanto para reativar (`true`) — o registro precisa
 * continuar existindo porque `occurrences.occurrence_type_id` é FK obrigatória,
 * e apagar o tipo levaria junto o histórico do cooperado.
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
 * específico de um campo continua no <p class="field__error"> dele. Com um
 * <dialog> aberto o toast fica atrás dele, então a recusa dentro de um modal
 * aparece no rodapé do próprio modal.
 */

import {dismissNotifications, notifyError, notifySuccess} from "../utils/notyf.js";

const API_URL = "/certificados-cooperados/api/v1/occurrence-types";

/** Esta tela precisa dos inativos para poder reativá-los; o GET raiz só traz ativos. */
const API_ALL_URL = `${API_URL}/all`;

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
   Texto vindo do banco
   ========================================================================= */

/**
 * O nome do tipo é digitado pelo usuário e volta da API, então não pode ser
 * interpolado cru.
 *
 * Vale para a tabela e também para o toast: o Notyf grava a mensagem com
 * innerHTML (vendor/notyf/notyf.es.js), então um tipo cadastrado com marcação
 * no nome viraria HTML na hora de confirmar a ação.
 */
function escapeHtml(value) {
    const characters = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"};
    return String(value ?? "").replace(/[&<>"']/g, character => characters[character]);
}

/* =========================================================================
   Erros de campo e de modal
   ========================================================================= */

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

function showModalError(element, message) {
    element.textContent = message;
    element.classList.remove("is-hidden");
}

function clearModalError(element) {
    element.textContent = "";
    element.classList.add("is-hidden");
}

/* =========================================================================
   Chamadas à API

   Todas passam por aqui para o 401 ter um tratamento só: sessão expirada volta
   para o login em vez de virar "não foi possível salvar". Repetir isso nas
   quatro operações convidaria a esquecer em uma delas.
   ========================================================================= */

/**
 * Devolve {ok, status, body} — ou `null` quando a sessão caiu e a navegação
 * para o login já foi disparada. Quem chama precisa parar nesse caso.
 */
async function apiRequest(url, {method = "GET", body} = {}) {
    const options = {method, credentials: "same-origin"};

    if (body !== undefined) {
        options.headers = {"Content-Type": "application/json"};
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (response.status === 401) {
        window.location.href = "login";
        return null;
    }

    // Corpo vazio (204) ou resposta que não é JSON não podem derrubar a leitura.
    const parsed = await response.json().catch(() => null);

    return {ok: response.ok, status: response.status, body: parsed};
}

/** A mensagem do ApiError, com um texto de reserva quando ela não vem. */
function messageOf(result, fallback) {
    return result.body?.message || fallback;
}

/** O mapa campo → mensagem do ApiError; vazio quando a recusa é de regra de negócio. */
function fieldsOf(result) {
    return result.body?.fields ?? {};
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
        const result = await apiRequest(API_ALL_URL);
        if (!result) return;

        if (!result.ok) {
            throw new Error(`A API respondeu ${result.status}`);
        }

        // A API devolve um array puro, já ordenado por nome (findAllOrderByName);
        // a guarda evita quebrar caso isso mude.
        const occurrenceTypes = Array.isArray(result.body) ? result.body : [];

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

/* =========================================================================
   Cadastro (POST)
   ========================================================================= */

async function handleSubmit(event) {
    event.preventDefault();

    // Os toasts do envio anterior saem da tela: o que vale é o resultado deste.
    dismissNotifications();
    clearFieldErrors(FORM_FIELDS);

    // Guardado agora: depois do primeiro await o event.currentTarget já é null,
    // porque o disparo do evento terminou.
    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');

    const name = document.getElementById("tipo-nome").value.trim();

    // Campo obrigatório barrado aqui: evita uma ida ao servidor para ouvir de
    // volta o que a tela já sabe. O resto da recusa continua sendo do backend.
    if (!name) {
        showFieldErrors(FORM_FIELDS, {name: "Informe o nome do tipo de ocorrência."})?.focus();
        return;
    }

    submitButton.disabled = true;

    try {
        const result = await apiRequest(API_URL, {method: "POST", body: {name}});
        if (!result) return;

        if (!result.ok) {
            // Nome repetido chega como regra de negócio (400 com `fields` vazio),
            // então o toast é o único lugar em que ela aparece.
            notifyError(messageOf(result, "Não foi possível cadastrar o tipo de ocorrência. Tente de novo."));
            showFieldErrors(FORM_FIELDS, fieldsOf(result))?.focus();
            return;
        }

        // Limpar antes de avisar: reset() dispara o evento de reset, que derruba
        // os toasts — na ordem inversa o sucesso apareceria e sumiria na hora.
        form.reset();
        notifySuccess(`${escapeHtml(result.body?.name ?? "O tipo")} já pode ser usado no lançamento de ocorrências.`);

        // A lista só é recarregada depois do 201, para não mostrar um tipo que o
        // backend recusou.
        await populateOccurrenceTypesTable();
    } catch (error) {
        notifyError("Não foi possível conectar ao servidor. Tente de novo.");
        console.error(error);
    } finally {
        submitButton.disabled = false;
    }
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
   Edição (PUT)
   ========================================================================= */

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

async function handleEditSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');
    const errorElement = document.querySelector("[data-edit-error]");
    const modal = document.querySelector("[data-type-edit-modal]");
    const id = form.dataset.typeId;

    clearFieldErrors(EDIT_FIELDS);
    clearModalError(errorElement);

    const name = document.getElementById("edicao-tipo-nome").value.trim();

    if (!name) {
        showFieldErrors(EDIT_FIELDS, {name: "Informe o nome do tipo de ocorrência."})?.focus();
        return;
    }

    submitButton.disabled = true;

    try {
        const result = await apiRequest(`${API_URL}/${id}`, {method: "PUT", body: {name}});
        if (!result) return;

        if (!result.ok) {
            // Com o modal aberto o toast fica atrás dele, então a recusa vai
            // para o rodapé do painel — inclusive a de nome repetido.
            showModalError(errorElement, messageOf(result, "Não foi possível salvar a edição. Tente de novo."));
            showFieldErrors(EDIT_FIELDS, fieldsOf(result))?.focus();
            return;
        }

        // Fechar antes de avisar: com o <dialog> na top layer, o toast
        // desenhado embaixo dele passaria despercebido.
        modal.close();
        notifySuccess(`O tipo agora se chama ${escapeHtml(result.body?.name ?? name)}.`);

        await populateOccurrenceTypesTable();
    } catch (error) {
        showModalError(errorElement, "Não foi possível conectar ao servidor. Tente de novo.");
        console.error(error);
    } finally {
        submitButton.disabled = false;
    }
}

function initEditModal() {
    const form = document.querySelector("[data-type-edit-form]");
    if (!form) return;

    form.addEventListener("submit", handleEditSubmit);
}

/* =========================================================================
   Situação (DELETE, soft)

   O mesmo modal serve para as duas ações: os textos são reescritos a cada
   abertura, porque desativar e reativar têm consequências opostas e um texto
   neutro não avisaria nada.
   ========================================================================= */

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

async function handleStatusConfirm(event) {
    const confirmButton = event.currentTarget;
    const errorElement = document.querySelector("[data-status-error]");
    const modal = document.querySelector("[data-type-status-modal]");

    const id = confirmButton.dataset.typeId;
    const occurrenceType = typesById.get(id);
    if (!occurrenceType) return;

    // A situação alvo é o inverso da atual — é o mesmo botão para os dois lados.
    const target = !occurrenceType.isActive;

    clearModalError(errorElement);
    confirmButton.disabled = true;

    try {
        // DELETE com corpo é o que este endpoint espera: ele não apaga, grava
        // `is_active`, e por isso precisa saber para qual valor.
        const result = await apiRequest(`${API_URL}/${id}`, {method: "DELETE", body: {isActive: target}});
        if (!result) return;

        if (!result.ok) {
            showModalError(errorElement, messageOf(result, "Não foi possível mudar a situação. Tente de novo."));
            return;
        }

        modal.close();
        notifySuccess(target
            ? `${escapeHtml(occurrenceType.name)} voltou a aparecer no lançamento de ocorrências.`
            : `${escapeHtml(occurrenceType.name)} não aparece mais no lançamento de ocorrências.`);

        await populateOccurrenceTypesTable();
    } catch (error) {
        showModalError(errorElement, "Não foi possível conectar ao servidor. Tente de novo.");
        console.error(error);
    } finally {
        confirmButton.disabled = false;
    }
}

function initStatusModal() {
    const confirmButton = document.querySelector("[data-status-confirm]");
    if (!confirmButton) return;

    confirmButton.addEventListener("click", handleStatusConfirm);
}

/* =========================================================================
   Ações da linha

   Um listener só no <tbody>, e não um por botão: as linhas são redesenhadas a
   cada recarga da tabela, e ligar botão a botão exigiria refazer tudo junto.
   ========================================================================= */

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
