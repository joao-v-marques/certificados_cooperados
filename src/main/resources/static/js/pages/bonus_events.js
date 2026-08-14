/**
 * Página de eventos premiados: lista, cadastra, edita, desativa e registra a
 * lista de presença de cada evento.
 *
 * Endpoints (todos sob o context-path da aplicação):
 *   GET    /api/v1/bonus-events?year=            eventos do ano, ativos e inativos
 *   POST   /api/v1/bonus-events                  {name, eventDate, points}
 *   PUT    /api/v1/bonus-events/{id}             {name, eventDate, points}
 *   DELETE /api/v1/bonus-events/{id}             soft delete → devolve o evento desativado
 *   GET    /api/v1/bonus-events/{id}/participations
 *   PUT    /api/v1/bonus-events/{id}/participations  {cooperativeMemberIds: []}
 *   GET    /api/v1/bonus-points/report?year=     usado só para o ano-base e os indicadores
 *
 * A presença é salva com o conjunto FINAL de cooperados marcados, e não um POST
 * por checkbox: assim reenviar a mesma lista não muda nada, os 40 lançamentos
 * viram uma transação só, e o navegador fechado no meio não deixa metade
 * gravada. Quem compara com o banco e decide o que inserir e apagar é o service.
 *
 * O relatório é chamado junto da listagem porque três coisas da tela saem dele e
 * não do cadastro de eventos: os anos que o select pode oferecer, o total
 * possível do ano (o denominador da faixa, que vem pronto do backend em vez de
 * ser recalculado aqui) e quantos cooperados já estão marcados em cada evento.
 *
 * Contrato com o HTML (data-*):
 *   [data-year-filter]        select do ano-base, escopa a tela inteira
 *   [data-kpi-*]              os três indicadores do topo
 *   [data-event-form]         formulário de cadastro, submit interceptado
 *   [data-events-table]       <tbody> da tabela
 *   [data-empty-state]        bloco de "nenhum evento no ano"
 *   [data-table-count]        rodapé com a contagem
 *   [data-event-edit-modal]   <dialog> da edição
 *   [data-event-edit-form]    formulário dentro do modal de edição
 *   [data-edit-error]         recusa da edição que não é de campo
 *   [data-presence-*]         modal da lista de presença
 *   [data-event-status-modal] <dialog> da confirmação de desativação
 *   [data-status-name]        nome do evento em destaque
 *   [data-status-confirm]     botão que confirma
 *   [data-status-error]       recusa da desativação
 *   [data-modal-close]        qualquer botão que fecha o modal em que está
 *
 * Nas linhas da tabela:
 *   [data-presence-event="<id>"]  abre a lista de presença
 *   [data-edit-event="<id>"]      abre a edição
 *   [data-status-event="<id>"]    abre a confirmação de desativação
 *
 * O retorno de sucesso e de erro sai em toast (ver utils/notyf.js); o que é
 * específico de um campo continua no <p class="field__error"> dele. Com um
 * <dialog> aberto o toast fica atrás dele, então a recusa dentro de um modal
 * aparece no rodapé do próprio modal.
 */

import {dismissNotifications, notifyError, notifySuccess} from "../utils/notyf.js";

const EVENTS_URL = "/certificados-cooperados/api/v1/bonus-events";
const REPORT_URL = "/certificados-cooperados/api/v1/bonus-points/report";

const FORM_FIELDS = {
    name: {inputId: "evento-nome", errorId: "erro-evento-nome"},
    eventDate: {inputId: "evento-data", errorId: "erro-evento-data"},
    points: {inputId: "evento-pontos", errorId: "erro-evento-pontos"},
};

const EDIT_FIELDS = {
    name: {inputId: "edicao-evento-nome", errorId: "erro-edicao-evento-nome"},
    eventDate: {inputId: "edicao-evento-data", errorId: "erro-edicao-evento-data"},
    points: {inputId: "edicao-evento-pontos", errorId: "erro-edicao-evento-pontos"},
};

/** Último resultado do GET, por id: os modais são preenchidos daqui. */
const eventsById = new Map();

/** Quantos cooperados estão marcados em cada evento, apurado do relatório. */
const markedByEvent = new Map();

/** Ano-base em vigor na tela. */
let currentYear = new Date().getFullYear();

/* =========================================================================
   Texto vindo do banco
   ========================================================================= */

/**
 * O nome do evento é digitado pelo usuário e volta da API, então não pode ser
 * interpolado cru.
 *
 * Vale para a tabela e também para o toast: o Notyf grava a mensagem com
 * innerHTML (vendor/notyf/notyf.es.js).
 */
function escapeHtml(value) {
    const characters = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"};
    return String(value ?? "").replace(/[&<>"']/g, character => characters[character]);
}

/** A data vem em ISO (yyyy-MM-dd) e é exibida no formato brasileiro. */
function formatDate(isoDate) {
    if (!isoDate) return "";
    const [year, month, day] = String(isoDate).split("-");
    return `${day}/${month}/${year}`;
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
   para o login em vez de virar "não foi possível salvar".
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

    const parsed = await response.json().catch(() => null);

    return {ok: response.ok, status: response.status, body: parsed};
}

function messageOf(result, fallback) {
    return result.body?.message || fallback;
}

function fieldsOf(result) {
    return result.body?.fields ?? {};
}

/* =========================================================================
   Ano-base
   ========================================================================= */

function fillYearFilter(availableYears) {
    const select = document.querySelector("[data-year-filter]");

    // O ano em vigor entra na lista mesmo que o backend não o tenha devolvido,
    // senão o select ficaria sem a opção que está selecionada.
    const years = [...new Set([...(availableYears ?? []), currentYear])]
        .sort((a, b) => b - a);

    select.innerHTML = years
        .map(year => `<option value="${year}">${year}</option>`)
        .join("");

    select.value = String(currentYear);
}

/* =========================================================================
   Indicadores
   ========================================================================= */

function updateSummary(events, report) {
    const active = events.filter(event => event.isActive);
    const inactive = events.length - active.length;

    document.querySelector("[data-kpi-events]").textContent = events.length;
    document.querySelector("[data-kpi-events-note]").textContent =
        inactive === 0 ? "Todos ativos." : `${inactive} desativado${inactive > 1 ? "s" : ""}.`;

    // Vêm prontos do backend em vez de recalculados aqui: a meta de curso que
    // entra no denominador é regra do CoursePointsPolicy, não da tela.
    document.querySelector("[data-kpi-points]").textContent = report?.totalEventPoints ?? "-";
    document.querySelector("[data-kpi-max]").textContent = report?.maxPossiblePoints ?? "-";

    document.querySelector("[data-kpi-max-note]").textContent = report
        ? `${report.totalEventPoints} em eventos + ${report.annualGoalPoints} da meta de cursos.`
        : "";
}

/* =========================================================================
   Listagem
   ========================================================================= */

function buildRow(event) {
    const row = document.createElement("tr");

    const isActive = event.isActive;

    const badgeClass = isActive ? "badge--success" : "badge--negative";
    const badgeLabel = isActive ? "Ativo" : "Inativo";

    const nameClass = isActive ? "table__primary" : "table__primary events-table__name--inactive";

    const marked = markedByEvent.get(String(event.id)) ?? 0;
    const markedLabel = marked === 1 ? "1 cooperado marcado" : `${marked} cooperados marcados`;

    row.innerHTML = `
        <td data-label="Evento">
            <span class="${nameClass}">${escapeHtml(event.name)}</span>
            <span class="events-table__marked">${markedLabel}</span>
        </td>
        <td data-label="Data" class="tabular">${formatDate(event.eventDate)}</td>
        <td data-label="Pontos" class="table__num tabular">${event.points}</td>
        <td data-label="Situação">
            <span class="badge ${badgeClass}">${badgeLabel}</span>
        </td>
        <td class="table__actions">
            <button type="button" class="btn-icon events-table__action"
                    data-presence-event="${event.id}" title="Lista de presença"
                    ${isActive ? "" : "disabled"}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h7" stroke="currentColor"
                          stroke-width="1.4" stroke-linecap="round"/>
                    <path d="m11 11.5 1.5 1.5 2.5-3" stroke="currentColor"
                          stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span class="visually-hidden">Lista de presença de ${escapeHtml(event.name)}</span>
            </button>
            <button type="button" class="btn-icon events-table__action"
                    data-edit-event="${event.id}" title="Editar evento">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M9.5 3 13 6.5 5.5 14H2v-3.5L9.5 3Z" stroke="currentColor"
                          stroke-width="1.4" stroke-linejoin="round"/>
                </svg>
                <span class="visually-hidden">Editar o evento ${escapeHtml(event.name)}</span>
            </button>
            <button type="button" class="btn-icon events-table__action events-table__action--danger"
                    data-status-event="${event.id}" title="Desativar evento"
                    ${isActive ? "" : "disabled"}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 2.5v6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                    <path d="M4.6 4.6a4.8 4.8 0 1 0 6.8 0" stroke="currentColor"
                          stroke-width="1.4" stroke-linecap="round"/>
                </svg>
                <span class="visually-hidden">Desativar o evento ${escapeHtml(event.name)}</span>
            </button>
        </td>
    `;

    return row;
}

/** Quantos cooperados estão marcados em cada evento, a partir do relatório. */
function collectMarkedCounts(report) {
    markedByEvent.clear();

    (report?.members ?? []).forEach(member => {
        (member.participatedEventIds ?? []).forEach(eventId => {
            const key = String(eventId);
            markedByEvent.set(key, (markedByEvent.get(key) ?? 0) + 1);
        });
    });
}

async function loadEvents() {
    const tbody = document.querySelector("[data-events-table]");
    const emptyState = document.querySelector("[data-empty-state]");
    const tableCount = document.querySelector("[data-table-count]");

    tbody.innerHTML = "";
    eventsById.clear();

    try {
        // As duas chamadas são independentes; em série a tela levaria o dobro
        // do tempo para montar.
        const [eventsResult, reportResult] = await Promise.all([
            apiRequest(`${EVENTS_URL}?year=${currentYear}`),
            apiRequest(`${REPORT_URL}?year=${currentYear}`),
        ]);

        if (!eventsResult || !reportResult) return;

        if (!eventsResult.ok) {
            throw new Error(`A API respondeu ${eventsResult.status}`);
        }

        const events = Array.isArray(eventsResult.body) ? eventsResult.body : [];
        const report = reportResult.ok ? reportResult.body : null;

        if (report) {
            fillYearFilter(report.availableYears);
            collectMarkedCounts(report);
        }

        const fragment = document.createDocumentFragment();

        events.forEach(event => {
            eventsById.set(String(event.id), event);
            fragment.appendChild(buildRow(event));
        });

        tbody.appendChild(fragment);
        updateSummary(events, report);

        tableCount.textContent = events.length === 1
            ? "1 evento neste ano"
            : `${events.length} eventos neste ano`;

        // Só agora, com a resposta em mãos, dá para afirmar que o ano não tem
        // evento nenhum.
        emptyState.hidden = events.length > 0;
    } catch (error) {
        // Falha de rede não é "nenhum evento cadastrado".
        emptyState.hidden = true;
        tableCount.textContent = "";

        notifyError("Não foi possível carregar os eventos do ano. Atualize a página.");
        console.error(error);
    }
}

/* =========================================================================
   Modais
   ========================================================================= */

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

    dismissNotifications();
    clearFieldErrors(FORM_FIELDS);

    // Guardado agora: depois do primeiro await o event.currentTarget já é null.
    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');

    const name = document.getElementById("evento-nome").value.trim();
    const eventDate = document.getElementById("evento-data").value;
    const points = document.getElementById("evento-pontos").value;

    // Obrigatórios barrados aqui: evita uma ida ao servidor para ouvir de volta
    // o que a tela já sabe. O resto da recusa continua sendo do backend.
    const missing = {};
    if (!name) missing.name = "Informe o nome do evento.";
    if (!eventDate) missing.eventDate = "Informe a data do evento.";
    if (!points) missing.points = "Informe a pontuação do evento.";

    if (Object.keys(missing).length > 0) {
        showFieldErrors(FORM_FIELDS, missing)?.focus();
        return;
    }

    submitButton.disabled = true;

    try {
        const result = await apiRequest(EVENTS_URL, {
            method: "POST",
            body: {name, eventDate, points: Number(points)},
        });
        if (!result) return;

        if (!result.ok) {
            // Nome repetido na mesma data chega como regra de negócio (400 com
            // `fields` vazio), então o toast é o único lugar em que ela aparece.
            notifyError(messageOf(result, "Não foi possível cadastrar o evento. Tente de novo."));
            showFieldErrors(FORM_FIELDS, fieldsOf(result))?.focus();
            return;
        }

        // Limpar antes de avisar: reset() dispara o evento de reset, que derruba
        // os toasts — na ordem inversa o sucesso apareceria e sumiria na hora.
        form.reset();
        notifySuccess(`${escapeHtml(result.body?.name ?? "O evento")} entrou na pontuação premiada.`);

        // O evento pode ter caído em outro ano que não o filtrado: a tela segue
        // o ano do que acabou de ser cadastrado, senão ele "sumiria".
        const createdYear = Number(String(result.body?.eventDate ?? "").slice(0, 4));
        if (createdYear && createdYear !== currentYear) currentYear = createdYear;

        await loadEvents();
    } catch (error) {
        notifyError("Não foi possível conectar ao servidor. Tente de novo.");
        console.error(error);
    } finally {
        submitButton.disabled = false;
    }
}

function initEventForm() {
    const form = document.querySelector("[data-event-form]");
    if (!form) return;

    form.addEventListener("submit", handleSubmit);

    form.addEventListener("reset", () => {
        dismissNotifications();
        clearFieldErrors(FORM_FIELDS);
    });
}

/* =========================================================================
   Edição (PUT)
   ========================================================================= */

function openEditModal(bonusEvent) {
    const modal = document.querySelector("[data-event-edit-modal]");
    const nameInput = document.getElementById("edicao-evento-nome");

    clearFieldErrors(EDIT_FIELDS);
    clearModalError(document.querySelector("[data-edit-error]"));

    document.querySelector("[data-event-edit-form]").dataset.eventId = String(bonusEvent.id);

    nameInput.value = bonusEvent.name;
    document.getElementById("edicao-evento-data").value = bonusEvent.eventDate;
    document.getElementById("edicao-evento-pontos").value = bonusEvent.points;

    modal.showModal();
    nameInput.focus();
    nameInput.select();
}

async function handleEditSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');
    const errorElement = document.querySelector("[data-edit-error]");
    const modal = document.querySelector("[data-event-edit-modal]");
    const id = form.dataset.eventId;

    clearFieldErrors(EDIT_FIELDS);
    clearModalError(errorElement);

    const name = document.getElementById("edicao-evento-nome").value.trim();
    const eventDate = document.getElementById("edicao-evento-data").value;
    const points = document.getElementById("edicao-evento-pontos").value;

    const missing = {};
    if (!name) missing.name = "Informe o nome do evento.";
    if (!eventDate) missing.eventDate = "Informe a data do evento.";
    if (!points) missing.points = "Informe a pontuação do evento.";

    if (Object.keys(missing).length > 0) {
        showFieldErrors(EDIT_FIELDS, missing)?.focus();
        return;
    }

    submitButton.disabled = true;

    try {
        const result = await apiRequest(`${EVENTS_URL}/${id}`, {
            method: "PUT",
            body: {name, eventDate, points: Number(points)},
        });
        if (!result) return;

        if (!result.ok) {
            // Com o modal aberto o toast fica atrás dele, então a recusa vai
            // para o rodapé do painel.
            showModalError(errorElement, messageOf(result, "Não foi possível salvar a edição. Tente de novo."));
            showFieldErrors(EDIT_FIELDS, fieldsOf(result))?.focus();
            return;
        }

        // Fechar antes de avisar: com o <dialog> na top layer, o toast desenhado
        // embaixo dele passaria despercebido.
        modal.close();
        notifySuccess(`${escapeHtml(result.body?.name ?? name)} foi atualizado.`);

        await loadEvents();
    } catch (error) {
        showModalError(errorElement, "Não foi possível conectar ao servidor. Tente de novo.");
        console.error(error);
    } finally {
        submitButton.disabled = false;
    }
}

function initEditModal() {
    const form = document.querySelector("[data-event-edit-form]");
    if (!form) return;

    form.addEventListener("submit", handleEditSubmit);
}

/* =========================================================================
   Lista de presença

   A tela guarda os marcados num Set e só manda o conjunto final no submit:
   marcar e desmarcar não fazem chamada nenhuma até o "Salvar presença".
   ========================================================================= */

const presenceState = {
    eventId: null,
    /** ids marcados agora na tela; começa como o que veio do banco. */
    marked: new Set(),
    /** ids que não podem ser desmarcados: cooperado inativo já registrado. */
    locked: new Set(),
    points: 0,
    total: 0,
};

function updatePresenceCounter() {
    const counter = document.querySelector("[data-presence-counter]");
    const marked = presenceState.marked.size;
    const distributed = marked * presenceState.points;

    counter.innerHTML =
        `<strong>${marked}</strong> de ${presenceState.total} marcados — ` +
        `<strong>${distributed}</strong> pontos distribuídos por este evento.`;
}

function buildPresenceItem(participant) {
    const item = document.createElement("li");
    const id = String(participant.cooperativeMemberId);

    // Já marcado e inativo: fica travado. Desmarcá-lo apagaria a participação de
    // alguém que realmente participou, só porque saiu do quadro depois.
    const locked = participant.participated && !participant.memberIsActive;

    item.className = locked ? "presence__item presence__item--locked" : "presence__item";
    item.dataset.memberName = String(participant.name ?? "").toLowerCase();

    item.innerHTML = `
        <label class="presence__label">
            <input type="checkbox" class="presence__check" value="${id}"
                   ${participant.participated ? "checked" : ""} ${locked ? "disabled" : ""}>
            <span class="presence__name">${escapeHtml(participant.name)}</span>
            ${locked ? '<span class="badge badge--neutral">Inativo</span>' : ""}
        </label>
    `;

    return item;
}

async function openPresenceModal(bonusEvent) {
    const modal = document.querySelector("[data-presence-modal]");
    const list = document.querySelector("[data-presence-list]");
    const search = document.getElementById("presenca-busca");

    clearModalError(document.querySelector("[data-presence-error]"));

    document.querySelector("[data-presence-subtitle]").textContent =
        `${bonusEvent.name} — ${formatDate(bonusEvent.eventDate)} — ${bonusEvent.points} pontos por participante.`;

    list.innerHTML = "";
    search.value = "";

    presenceState.eventId = bonusEvent.id;
    presenceState.points = bonusEvent.points;
    presenceState.marked = new Set();
    presenceState.locked = new Set();

    modal.showModal();

    try {
        const result = await apiRequest(`${EVENTS_URL}/${bonusEvent.id}/participations`);
        if (!result) return;

        if (!result.ok) {
            showModalError(document.querySelector("[data-presence-error]"),
                messageOf(result, "Não foi possível carregar a lista de presença."));
            return;
        }

        const participants = result.body?.participants ?? [];
        presenceState.total = participants.length;

        const fragment = document.createDocumentFragment();

        participants.forEach(participant => {
            const id = String(participant.cooperativeMemberId);

            if (participant.participated) presenceState.marked.add(id);
            if (participant.participated && !participant.memberIsActive) presenceState.locked.add(id);

            fragment.appendChild(buildPresenceItem(participant));
        });

        list.appendChild(fragment);
        updatePresenceCounter();

        document.querySelector("[data-presence-empty]").hidden = participants.length > 0;

        search.focus();
    } catch (error) {
        showModalError(document.querySelector("[data-presence-error]"),
            "Não foi possível conectar ao servidor. Tente de novo.");
        console.error(error);
    }
}

/** Aplica a busca escondendo as linhas que não batem, sem recriar a lista. */
function filterPresenceList(term) {
    const normalized = term.trim().toLowerCase();
    const items = document.querySelectorAll("[data-presence-list] .presence__item");

    let visible = 0;

    items.forEach(item => {
        const matches = !normalized || item.dataset.memberName.includes(normalized);
        item.hidden = !matches;
        if (matches) visible++;
    });

    document.querySelector("[data-presence-empty]").hidden = visible > 0;
}

/** Marca ou desmarca só o que está visível no filtro. */
function bulkPresence(checked) {
    document.querySelectorAll("[data-presence-list] .presence__item").forEach(item => {
        if (item.hidden) return;

        const input = item.querySelector(".presence__check");
        if (!input || input.disabled) return;

        input.checked = checked;

        if (checked) presenceState.marked.add(input.value);
        else presenceState.marked.delete(input.value);
    });

    updatePresenceCounter();
}

async function handlePresenceSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');
    const errorElement = document.querySelector("[data-presence-error]");
    const modal = document.querySelector("[data-presence-modal]");

    clearModalError(errorElement);
    submitButton.disabled = true;

    try {
        const result = await apiRequest(`${EVENTS_URL}/${presenceState.eventId}/participations`, {
            method: "PUT",
            body: {cooperativeMemberIds: [...presenceState.marked].map(Number)},
        });
        if (!result) return;

        if (!result.ok) {
            showModalError(errorElement, messageOf(result, "Não foi possível salvar a lista de presença."));
            return;
        }

        const marked = result.body?.markedCount ?? presenceState.marked.size;

        modal.close();
        notifySuccess(marked === 1
            ? "1 cooperado registrado neste evento."
            : `${marked} cooperados registrados neste evento.`);

        await loadEvents();
    } catch (error) {
        showModalError(errorElement, "Não foi possível conectar ao servidor. Tente de novo.");
        console.error(error);
    } finally {
        submitButton.disabled = false;
    }
}

function initPresenceModal() {
    const form = document.querySelector("[data-presence-form]");
    if (!form) return;

    form.addEventListener("submit", handlePresenceSubmit);

    // Um listener só na lista: os itens são recriados a cada abertura do modal.
    document.querySelector("[data-presence-list]").addEventListener("change", event => {
        const input = event.target.closest(".presence__check");
        if (!input) return;

        if (input.checked) presenceState.marked.add(input.value);
        else presenceState.marked.delete(input.value);

        updatePresenceCounter();
    });

    document.getElementById("presenca-busca")
        .addEventListener("input", event => filterPresenceList(event.target.value));

    document.querySelector("[data-presence-select-all]")
        .addEventListener("click", () => bulkPresence(true));

    document.querySelector("[data-presence-clear-all]")
        .addEventListener("click", () => bulkPresence(false));
}

/* =========================================================================
   Desativação (DELETE, soft)
   ========================================================================= */

function openStatusModal(bonusEvent) {
    const modal = document.querySelector("[data-event-status-modal]");
    const confirmButton = document.querySelector("[data-status-confirm]");

    clearModalError(document.querySelector("[data-status-error]"));

    // textContent, e não innerHTML: o nome vem do cadastro e não pode ser
    // interpretado como marcação.
    document.querySelector("[data-status-name]").textContent = bonusEvent.name;

    confirmButton.dataset.eventId = String(bonusEvent.id);

    modal.showModal();
    confirmButton.focus();
}

async function handleStatusConfirm(event) {
    const confirmButton = event.currentTarget;
    const errorElement = document.querySelector("[data-status-error]");
    const modal = document.querySelector("[data-event-status-modal]");

    const id = confirmButton.dataset.eventId;
    const bonusEvent = eventsById.get(id);
    if (!bonusEvent) return;

    clearModalError(errorElement);
    confirmButton.disabled = true;

    try {
        const result = await apiRequest(`${EVENTS_URL}/${id}`, {method: "DELETE"});
        if (!result) return;

        if (!result.ok) {
            showModalError(errorElement, messageOf(result, "Não foi possível desativar o evento. Tente de novo."));
            return;
        }

        modal.close();
        notifySuccess(`${escapeHtml(bonusEvent.name)} saiu da matriz de pontuação.`);

        await loadEvents();
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
   cada recarga da tabela.
   ========================================================================= */

function initRowActions() {
    const tbody = document.querySelector("[data-events-table]");
    if (!tbody) return;

    tbody.addEventListener("click", event => {
        const presenceButton = event.target.closest("[data-presence-event]");
        if (presenceButton) {
            const bonusEvent = eventsById.get(presenceButton.dataset.presenceEvent);
            if (bonusEvent) openPresenceModal(bonusEvent);
            return;
        }

        const editButton = event.target.closest("[data-edit-event]");
        if (editButton) {
            const bonusEvent = eventsById.get(editButton.dataset.editEvent);
            if (bonusEvent) openEditModal(bonusEvent);
            return;
        }

        const statusButton = event.target.closest("[data-status-event]");
        if (statusButton) {
            const bonusEvent = eventsById.get(statusButton.dataset.statusEvent);
            if (bonusEvent) openStatusModal(bonusEvent);
        }
    });
}

/* =========================================================================
   Ano-base
   ========================================================================= */

function initYearFilter() {
    const select = document.querySelector("[data-year-filter]");
    if (!select) return;

    select.addEventListener("change", () => {
        currentYear = Number(select.value);
        loadEvents();
    });
}

/* =========================================================================
   Ligação
   ========================================================================= */

function init() {
    initYearFilter();
    initEventForm();
    initModalClosers();
    initEditModal();
    initPresenceModal();
    initStatusModal();
    initRowActions();
    loadEvents();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
