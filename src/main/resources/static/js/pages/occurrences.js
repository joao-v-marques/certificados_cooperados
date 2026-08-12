/**
 * Listagem de ocorrências: preenche a tabela, filtra, abre o detalhe de cada
 * uma e cuida da edição e da exclusão.
 *
 * Contrato com o HTML (data-*):
 *   [data-filters]            barra de filtros; qualquer mudança refiltra
 *   [data-clear-filters]      zera os cinco campos de uma vez
 *   [data-empty-state]        bloco de vazio, com [data-empty-title] e [data-empty-text]
 *   [data-table-count]        rodapé com a contagem de linhas mostradas
 *   [data-view-occurrence]    gatilho do detalhe; o valor é o id da ocorrência
 *   [data-edit-occurrence]    gatilho da edição; o valor é o id da ocorrência
 *   [data-delete-occurrence]  gatilho da exclusão; o valor é o id da ocorrência
 *   [data-modal-close]        fecha o modal em que está, nos três
 *
 * Modal de detalhe, dentro de [data-occurrence-modal]:
 *   [data-detail-member] / -type / -date / -inserted-by / -created-at
 *   [data-detail-observations]
 *
 * Modal de edição, dentro de [data-occurrence-edit-modal]:
 *   [data-occurrence-edit-form]  formulário, submit interceptado (PUT)
 *   [data-edit-inserted-by] / [data-edit-created-at]  só leitura, no subtítulo
 *
 * Modal de exclusão, dentro de [data-occurrence-delete-modal]:
 *   [data-delete-question]    a pergunta, montada com os dados da linha
 *   [data-delete-excerpt]     trecho das observações, para reconhecer qual é
 *   [data-delete-confirm]     dispara o DELETE
 *
 * Por id: tbodyOccurrences, cardOccurrencesQtd, filtro-cooperado, filtro-tipo,
 * filtro-lancado-por, filtro-data-de, filtro-data-ate e os campos da edição
 * (edicao-cooperado, edicao-tipo, edicao-data, edicao-observacoes, com os
 * erro-edicao-* correspondentes).
 *
 * Filtro e detalhe acontecem sobre a lista que GET /api/v1/occurrences já
 * trouxe. O endpoint não recebe parâmetro de busca, e enquanto o volume for
 * o de uma secretaria executiva filtrar no navegador é mais rápido que ir ao
 * servidor a cada campo. Quando a base crescer a ponto de pesar, o caminho é
 * mover estes mesmos filtros para query params no OccurrenceController.
 *
 * Edição e exclusão não recarregam a listagem: o PUT devolve a ocorrência
 * atualizada e o DELETE só confirma: dá para acertar a lista em memória e
 * redesenhar sem uma segunda ida ao servidor — e sem o piscar que a recarga
 * causaria na tabela inteira.
 */

import {dismissNotifications, notifyError, notifySuccess} from "../utils/notyf.js";

const OCCURRENCES_URL = "/certificados-cooperados/api/v1/occurrences";
const OCCURRENCE_TYPES_URL = "/certificados-cooperados/api/v1/occurrence-types";
const ACTIVE_MEMBERS_URL = "/certificados-cooperados/api/v1/cooperative-members?active=true";

/** Quantos caracteres da observação vão para a célula. O corte visual é do CSS
 *  (-webkit-line-clamp); este aqui evita despejar 2000 caracteres por linha no
 *  DOM só para escondê-los em seguida. */
const EXCERPT_LENGTH = 200;

/** Tudo que a API devolveu, na ordem em que veio. É a fonte dos filtros. */
let allOccurrences = [];

/** Ocorrências por id, para o modal abrir sem nova consulta. */
const occurrencesById = new Map();

/** Ocorrência aberta no modal de edição e no de exclusão. Zerados no fechamento
 *  para uma confirmação nunca sobrar de um modal anterior. */
let editingId = null;
let deletingId = null;

/**
 * Cooperados ativos e tipos ativos, buscados uma vez só e reaproveitados por
 * todas as edições da sessão. É promessa, e não array, para dois cliques
 * seguidos no lápis não dispararem duas vezes as mesmas requisições.
 */
let editOptionsPromise = null;

/** Liga o campo que o backend devolve em `fields` aos elementos do modal de
 *  edição. Mesmo arranjo do lançamento (js/pages/new_occurrence.js). */
const EDIT_FIELDS = {
    cooperativeMemberId: {inputId: "edicao-cooperado", errorId: "erro-edicao-cooperado"},
    occurrenceTypeId: {inputId: "edicao-tipo", errorId: "erro-edicao-tipo"},
    occurrenceDate: {inputId: "edicao-data", errorId: "erro-edicao-data"},
    observations: {inputId: "edicao-observacoes", errorId: "erro-edicao-observacoes"},
};

/* =========================================================================
   Formatação
   ========================================================================= */

// O texto vem do cadastro e das observações digitadas por uma pessoa: não pode
// ser interpolado cru em innerHTML.
function escapeHtml(value) {
    const characters = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"};
    return String(value ?? "").replace(/[&<>"']/g, character => characters[character]);
}

/**
 * Data em pt-BR.
 *
 * A data-só (yyyy-MM-dd) é montada no texto, sem passar por Date: o construtor
 * lê esse formato como UTC e, no fuso do Brasil, a ocorrência do dia 14
 * apareceria como 13. Só o createdAt, que é instante de verdade, usa Date.
 */
function formatDate(value) {
    if (!value) return "—";

    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-BR");
}

// O lançamento é instante: dia e hora, porque duas ocorrências do mesmo dia se
// distinguem pela hora em que foram registradas.
function formatDateTime(value) {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString("pt-BR", {dateStyle: "short", timeStyle: "short"});
}

function buildExcerpt(observations) {
    const text = String(observations ?? "").trim();

    return text.length > EXCERPT_LENGTH
        ? {text: `${text.slice(0, EXCERPT_LENGTH)}…`, truncated: true}
        : {text, truncated: false};
}

/* =========================================================================
   Filtros
   ========================================================================= */

const filterElements = () => ({
    member: document.getElementById("filtro-cooperado"),
    type: document.getElementById("filtro-tipo"),
    insertedBy: document.getElementById("filtro-lancado-por"),
    from: document.getElementById("filtro-data-de"),
    to: document.getElementById("filtro-data-ate"),
});

function readFilters() {
    const elements = filterElements();

    return {
        member: elements.member.value,
        type: elements.type.value,
        insertedBy: elements.insertedBy.value,
        from: elements.from.value,
        to: elements.to.value,
    };
}

const hasActiveFilters = filters => Object.values(filters).some(value => value !== "");

/**
 * Monta as opções de um select a partir dos valores que aparecem nos dados.
 *
 * Sai da lista carregada, e não de um endpoint de cadastro, porque o filtro só
 * deve oferecer o que existe: um cooperado sem nenhuma ocorrência na lista
 * levaria a tabela a zero resultado sem o usuário entender o motivo.
 */
function fillSelect(select, pairs) {
    // A primeira opção ("Todos...") vem do HTML e é o estado neutro do filtro.
    const placeholder = select.querySelector("option");

    // Guardado antes de reescrever: a lista é remontada também depois de uma
    // edição ou de uma exclusão, e sem isto o filtro em uso se perderia no meio
    // do trabalho de quem está conferindo os registros de um cooperado.
    const previous = select.value;

    select.innerHTML = "";
    select.appendChild(placeholder);

    const fragment = document.createDocumentFragment();

    pairs.forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        // textContent, e não innerHTML: o nome vem do banco.
        option.textContent = label;
        fragment.appendChild(option);
    });

    select.appendChild(fragment);

    // Só volta se o valor ainda existir nos dados: excluir a última ocorrência
    // de um cooperado tira o nome dele da lista, e insistir no filtro antigo
    // deixaria a tabela vazia sem opção correspondente na tela.
    select.value = [...select.options].some(option => option.value === previous) ? previous : "";
}

// Pares únicos [valor, rótulo], ordenados pelo rótulo em pt-BR para acento não
// jogar nomes para o fim da lista.
function distinctPairs(occurrences, valueOf, labelOf) {
    const pairs = new Map();

    occurrences.forEach(occurrence => {
        const value = valueOf(occurrence);
        if (value === null || value === undefined || value === "") return;

        pairs.set(String(value), labelOf(occurrence));
    });

    return [...pairs.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
}

function populateFilterOptions(occurrences) {
    const elements = filterElements();

    fillSelect(elements.member,
        distinctPairs(occurrences, o => o.cooperativeMemberId, o => o.cooperativeMemberName));

    // O tipo é filtrado pelo nome porque o response não traz o id — e a coluna
    // name é UNIQUE no banco, então o nome identifica o tipo sem ambiguidade.
    fillSelect(elements.type,
        distinctPairs(occurrences, o => o.occurrenceTypeName, o => o.occurrenceTypeName));

    fillSelect(elements.insertedBy,
        distinctPairs(occurrences, o => o.insertedByName, o => o.insertedByName));
}

/**
 * Aplica os cinco filtros. Campo vazio não filtra nada.
 *
 * As datas são comparadas como texto ISO (yyyy-MM-dd), em que a ordem
 * alfabética é a ordem cronológica. Evita converter para Date só para comparar
 * — e, de quebra, evita de novo o deslocamento de fuso.
 */
function filterOccurrences(filters) {
    return allOccurrences.filter(occurrence => {
        if (filters.member && String(occurrence.cooperativeMemberId) !== filters.member) return false;
        if (filters.type && occurrence.occurrenceTypeName !== filters.type) return false;
        if (filters.insertedBy && occurrence.insertedByName !== filters.insertedBy) return false;

        const date = occurrence.occurrenceDate ?? "";
        if (filters.from && date < filters.from) return false;
        if (filters.to && date > filters.to) return false;

        return true;
    });
}

/**
 * Cada ponta do período limita a outra, para não existir intervalo invertido.
 * O teto dos dois é hoje: ocorrência futura não é aceita no lançamento, então
 * também não há o que procurar depois de hoje.
 */
function syncDateBounds() {
    const elements = filterElements();
    const today = new Date().toLocaleDateString("en-CA");

    elements.from.max = elements.to.value || today;
    elements.to.min = elements.from.value || "";
    elements.to.max = today;
}

/* =========================================================================
   Tabela
   ========================================================================= */

function buildRow(occurrence) {
    const excerpt = buildExcerpt(occurrence.observations);

    // "Ver detalhe" só quando há texto escondido; no resto das linhas o modal
    // continua acessível pelo clique, mas anunciá-lo seria prometer novidade
    // que não existe.
    const more = excerpt.truncated
        ? `<span class="occurrences-table__more" aria-hidden="true">Ver detalhe</span>`
        : "";

    const row = document.createElement("tr");

    row.innerHTML = `
        <td data-label="Cooperado">
            <span class="table__primary">${escapeHtml(occurrence.cooperativeMemberName)}</span>
        </td>
        <td data-label="Tipo">
            <span class="badge badge--neutral">${escapeHtml(occurrence.occurrenceTypeName)}</span>
        </td>
        <td data-label="Data" class="tabular">${escapeHtml(formatDate(occurrence.occurrenceDate))}</td>
        <td data-label="Observações">
            <button type="button" class="occurrences-table__excerpt"
                    data-view-occurrence="${occurrence.id}">${escapeHtml(excerpt.text)}</button>
            ${more}
        </td>
        <td data-label="Lançado por">${escapeHtml(occurrence.insertedByName)}</td>
        <td class="table__actions">
            <button type="button" class="btn-icon occurrences-table__action"
                    data-edit-occurrence="${occurrence.id}" title="Editar ocorrência">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M9.5 3 13 6.5 5.5 14H2v-3.5L9.5 3Z" stroke="currentColor"
                          stroke-width="1.4" stroke-linejoin="round"/>
                </svg>
                <span class="visually-hidden">Editar a ocorrência de ${escapeHtml(occurrence.cooperativeMemberName)}</span>
            </button>
            <button type="button" class="btn-icon occurrences-table__action occurrences-table__action--danger"
                    data-delete-occurrence="${occurrence.id}" title="Excluir ocorrência">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M2.5 4.5h11M6.5 4.5V3h3v1.5M4.5 4.5 5 13.5h6l.5-9" stroke="currentColor"
                          stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span class="visually-hidden">Excluir a ocorrência de ${escapeHtml(occurrence.cooperativeMemberName)}</span>
            </button>
        </td>
    `;

    return row;
}

/**
 * Desenha as linhas visíveis e acerta rodapé e estado vazio.
 *
 * O vazio tem dois textos diferentes: sem nenhum lançamento no sistema e sem
 * resultado para o filtro escolhido são situações distintas, e usar a mesma
 * frase faria o usuário achar que os registros sumiram.
 */
function renderOccurrences(occurrences, filters) {
    const tbody = document.getElementById("tbodyOccurrences");
    const emptyState = document.querySelector("[data-empty-state]");
    const emptyTitle = document.querySelector("[data-empty-title]");
    const emptyText = document.querySelector("[data-empty-text]");
    const countTarget = document.querySelector("[data-table-count]");

    tbody.innerHTML = ``;

    const fragment = document.createDocumentFragment();
    occurrences.forEach(occurrence => fragment.appendChild(buildRow(occurrence)));
    tbody.appendChild(fragment);

    const filtering = hasActiveFilters(filters);

    if (occurrences.length) {
        countTarget.textContent = filtering
            ? `${occurrences.length} de ${allOccurrences.length} ocorrências`
            : `${allOccurrences.length} ${allOccurrences.length === 1 ? "ocorrência lançada" : "ocorrências lançadas"}`;
    } else {
        countTarget.textContent = "";
    }

    emptyState.hidden = occurrences.length > 0;

    if (occurrences.length) return;

    if (filtering) {
        emptyTitle.textContent = "Nenhuma ocorrência corresponde aos filtros";
        emptyText.textContent = "Ajuste ou limpe os filtros para ver os demais registros.";
    } else {
        emptyTitle.textContent = "Nenhuma ocorrência lançada ainda";
        emptyText.textContent = "Assim que a secretaria executiva registrar a primeira solicitação de um cooperado, ela aparece aqui.";
    }
}

function applyFilters() {
    const filters = readFilters();

    syncDateBounds();

    document.querySelector("[data-clear-filters]").disabled = !hasActiveFilters(filters);

    renderOccurrences(filterOccurrences(filters), filters);
}

/**
 * Reflete na tela o que está em `allOccurrences`.
 *
 * Roda depois da carga, da edição e da exclusão: as três mexem na mesma lista,
 * e o índice por id, o card, as opções de filtro e a tabela precisam terminar
 * contando a mesma história.
 */
function refreshOccurrences() {
    occurrencesById.clear();
    allOccurrences.forEach(occurrence => occurrencesById.set(String(occurrence.id), occurrence));

    // O card conta o total lançado, e não o que sobrou do filtro: é o número
    // do sistema, não da consulta em curso. O recorte fica no rodapé.
    document.getElementById("cardOccurrencesQtd").textContent = allOccurrences.length;

    populateFilterOptions(allOccurrences);
    applyFilters();
}

async function loadOccurrences() {
    const card = document.getElementById("cardOccurrencesQtd");

    try {
        const response = await fetch(OCCURRENCES_URL, {credentials: "same-origin"});

        // Sessão expirada volta para o login em vez de virar "não foi possível
        // carregar".
        if (response.status === 401) {
            window.location.href = "login";
            return;
        }

        if (!response.ok) {
            throw new Error(`A API respondeu ${response.status}`);
        }

        const responseJSON = await response.json();

        // A API devolve um array puro; a guarda evita quebrar caso isso mude.
        allOccurrences = Array.isArray(responseJSON) ? responseJSON : [];

        refreshOccurrences();
    } catch (error) {
        // Falha de rede não é "nenhuma ocorrência lançada" — o bloco continua
        // oculto para não mentir sobre o estado do sistema.
        document.querySelector("[data-empty-state]").hidden = true;
        document.querySelector("[data-table-count]").textContent = "";
        card.textContent = "-";

        notifyError("Não foi possível carregar as ocorrências. Atualize a página.");
        console.error(error);
    }
}

/* =========================================================================
   Modal de detalhe
   ========================================================================= */

function openOccurrenceModal(occurrenceId) {
    const occurrence = occurrencesById.get(String(occurrenceId));
    if (!occurrence) return;

    const modal = document.querySelector("[data-occurrence-modal]");

    // textContent em tudo: o conteúdo vem do cadastro e das observações
    // digitadas, e não pode ser interpretado como marcação.
    modal.querySelector("[data-detail-member]").textContent = occurrence.cooperativeMemberName;
    modal.querySelector("[data-detail-type]").textContent = occurrence.occurrenceTypeName;
    modal.querySelector("[data-detail-date]").textContent = formatDate(occurrence.occurrenceDate);
    modal.querySelector("[data-detail-inserted-by]").textContent = occurrence.insertedByName;
    modal.querySelector("[data-detail-created-at]").textContent = formatDateTime(occurrence.createdAt);
    modal.querySelector("[data-detail-observations]").textContent = occurrence.observations;

    modal.showModal();
}

function initOccurrenceModal() {
    const modal = document.querySelector("[data-occurrence-modal]");

    modal.addEventListener("click", event => {
        // Clique que cai no próprio <dialog> é clique no fundo: o conteúdo
        // cobre toda a área do painel.
        if (event.target === modal || event.target.closest("[data-modal-close]")) {
            modal.close();
        }
    });
}

/* =========================================================================
   Modal de edição (PUT)
   ========================================================================= */

/* Erros de campo -------------------------------------------------------- */

/**
 * Mensagem de recusa dentro do próprio modal.
 *
 * O toast continua saindo, como no resto da aplicação, mas não pode ser a
 * única saída: <dialog> aberto por showModal vai para a top layer do navegador
 * e passa por cima do canto onde o Notyf desenha. Sem mensagem no modal, a
 * recusa que não é de campo — cooperado inativado no meio da edição, ocorrência
 * excluída por outra pessoa — ficaria escondida atrás dele.
 */
function showModalError(element, message) {
    element.textContent = message ?? "";
    element.classList.toggle("is-hidden", !message);
}

function clearEditFieldErrors() {
    Object.values(EDIT_FIELDS).forEach(({inputId, errorId}) => {
        const errorElement = document.getElementById(errorId);

        document.getElementById(inputId).removeAttribute("aria-invalid");
        errorElement.textContent = "";
        errorElement.classList.add("is-hidden");
    });
}

// Recebe o mapa `fields` do ApiError e devolve o primeiro campo marcado, para
// levar o foco até ele.
function showEditFieldErrors(fields) {
    let firstInvalid = null;

    Object.entries(fields).forEach(([field, message]) => {
        const target = EDIT_FIELDS[field];
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

/* Selects do modal ------------------------------------------------------ */

async function fetchJson(url) {
    const response = await fetch(url, {credentials: "same-origin"});

    // Sessão expirada volta para o login, e não para um toast de falha: o
    // problema não é a lista, é que não há mais sessão.
    if (response.status === 401) {
        window.location.href = "login";
        // A promessa nunca resolve; a navegação já está em curso.
        return new Promise(() => {});
    }

    if (!response.ok) throw new Error(`${url} respondeu ${response.status}`);

    const responseJSON = await response.json();

    return Array.isArray(responseJSON) ? responseJSON : [];
}

/**
 * Cooperados e tipos ativos, buscados na primeira edição e guardados depois.
 *
 * Só os ativos, como no lançamento: o PUT recusa cooperado inativo e tipo
 * desativado, então oferecê-los aqui seria propor uma escolha que volta como
 * erro. A promessa é descartada em caso de falha para o clique seguinte poder
 * tentar de novo em vez de repetir o erro guardado.
 */
function loadEditOptions() {
    if (!editOptionsPromise) {
        editOptionsPromise = Promise.all([
            fetchJson(ACTIVE_MEMBERS_URL),
            fetchJson(OCCURRENCE_TYPES_URL),
        ]).catch(error => {
            editOptionsPromise = null;
            throw error;
        });
    }

    return editOptionsPromise;
}

/**
 * Preenche uma select do modal e marca o valor gravado na ocorrência.
 *
 * Quando esse valor não está mais entre os ativos — o cooperado foi inativado,
 * o tipo desativado — ele entra como opção desabilitada: o campo continua
 * mostrando o que a ocorrência tem hoje, mas salvar exige escolher um
 * substituto, que é exatamente a regra que o OccurrenceService aplica.
 */
function fillEditSelect(select, items, currentValue, currentLabel, inactiveSuffix) {
    select.innerHTML = "";

    const fragment = document.createDocumentFragment();

    items.forEach(item => {
        const option = document.createElement("option");
        option.value = String(item.id);
        // textContent, e não innerHTML: o nome vem do banco.
        option.textContent = item.name;
        fragment.appendChild(option);
    });

    select.appendChild(fragment);

    const value = currentValue === null || currentValue === undefined ? "" : String(currentValue);
    const listed = [...select.options].some(option => option.value === value);

    if (!listed) {
        const option = document.createElement("option");
        // Fica sem valor quando nem o id é conhecido — é o caso do tipo, que a
        // listagem devolve só pelo nome. Aí o envio cai no @NotNull do backend,
        // que é a mensagem certa: falta escolher um tipo válido.
        option.value = value;
        option.textContent = `${currentLabel} ${inactiveSuffix}`;
        option.disabled = true;
        select.insertBefore(option, select.firstChild);
    }

    select.value = value;
}

async function openEditModal(occurrenceId) {
    const occurrence = occurrencesById.get(String(occurrenceId));
    if (!occurrence) return;

    let members;
    let types;

    // As listas vêm antes de abrir: um modal que aparece com as selects vazias
    // e se preenche depois convida a salvar no meio do carregamento.
    try {
        [members, types] = await loadEditOptions();
    } catch (error) {
        notifyError("Não foi possível carregar cooperados e tipos. Tente de novo.");
        console.error(error);
        return;
    }

    const modal = document.querySelector("[data-occurrence-edit-modal]");

    clearEditFieldErrors();
    showModalError(modal.querySelector("[data-edit-error]"), "");

    modal.querySelector("[data-edit-inserted-by]").textContent = occurrence.insertedByName;
    modal.querySelector("[data-edit-created-at]").textContent = formatDateTime(occurrence.createdAt);

    fillEditSelect(
        document.getElementById("edicao-cooperado"),
        members,
        occurrence.cooperativeMemberId,
        occurrence.cooperativeMemberName,
        "(inativo)",
    );

    // O response traz o tipo só pelo nome, sem id. Casar por nome é seguro:
    // occurrence_types.name é UNIQUE no banco.
    const currentType = types.find(type => type.name === occurrence.occurrenceTypeName);

    fillEditSelect(
        document.getElementById("edicao-tipo"),
        types,
        currentType ? currentType.id : null,
        occurrence.occurrenceTypeName,
        "(desativado)",
    );

    const dateInput = document.getElementById("edicao-data");
    // Data futura é recusada pelo backend (@PastOrPresent); bloquear no seletor
    // evita que o usuário escolha uma para só depois descobrir.
    dateInput.max = new Date().toLocaleDateString("en-CA");
    dateInput.value = occurrence.occurrenceDate ?? "";

    document.getElementById("edicao-observacoes").value = occurrence.observations ?? "";

    editingId = occurrence.id;
    modal.showModal();
}

/* Envio ----------------------------------------------------------------- */

// Select vazia vira null, e não 0: Number("") daria zero, que é um id válido
// para o binder e faria o backend procurar um registro em vez de responder o
// @NotNull escrito para o usuário.
function readEditId(elementId) {
    const value = document.getElementById(elementId).value;
    return value ? Number(value) : null;
}

function readEditForm() {
    return {
        occurrenceTypeId: readEditId("edicao-tipo"),
        cooperativeMemberId: readEditId("edicao-cooperado"),
        occurrenceDate: document.getElementById("edicao-data").value || null,
        observations: document.getElementById("edicao-observacoes").value.trim(),
    };
}

// Troca a ocorrência editada pela versão que o PUT devolveu e redesenha. Sem
// nova consulta: o response é a ocorrência inteira, com os nomes resolvidos.
function replaceOccurrence(updated) {
    const index = allOccurrences.findIndex(occurrence => occurrence.id === updated.id);

    if (index === -1) return;

    allOccurrences[index] = updated;
    refreshOccurrences();
}

async function handleEditSubmit(event) {
    event.preventDefault();

    // Os toasts do envio anterior saem da tela: o que vale é o resultado deste.
    dismissNotifications();
    clearEditFieldErrors();

    // Guardado agora: depois do primeiro await o event.currentTarget já é null,
    // porque o disparo do evento terminou.
    const form = event.currentTarget;
    const modal = form.closest("dialog");
    const submitButton = form.querySelector('button[type="submit"]');

    showModalError(modal.querySelector("[data-edit-error]"), "");

    submitButton.disabled = true;
    submitButton.classList.add("is-loading");

    try {
        const response = await fetch(`${OCCURRENCES_URL}/${editingId}`, {
            method: "PUT",
            credentials: "same-origin",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(readEditForm()),
        });

        // Sessão expirada no meio da edição: o entryPoint responde 401 e a
        // página de login mostra o aviso.
        if (response.status === 401) {
            window.location.href = "login";
            return;
        }

        const body = await response.json().catch(() => null);

        if (!response.ok) {
            // O corpo é sempre {message, fields}: `fields` vem preenchido na
            // validação das anotações e vazio quando é regra de negócio
            // (cooperado inativo, tipo desativado).
            const message = body?.message || "Não foi possível salvar a edição. Tente de novo.";

            notifyError(message);

            const firstInvalid = showEditFieldErrors(body?.fields ?? {});

            // Com campo marcado a mensagem geral no rodapé seria repetição: o
            // erro já está escrito embaixo do campo certo.
            showModalError(modal.querySelector("[data-edit-error]"), firstInvalid ? "" : message);

            if (firstInvalid) firstInvalid.focus();
            return;
        }

        replaceOccurrence(body);
        modal.close();
        notifySuccess(`Ocorrência de ${body?.cooperativeMemberName ?? "o cooperado"} atualizada.`);
    } catch (error) {
        const message = "Não foi possível conectar ao servidor. Tente de novo.";

        notifyError(message);
        showModalError(modal.querySelector("[data-edit-error]"), message);
        console.error(error);
    } finally {
        submitButton.disabled = false;
        submitButton.classList.remove("is-loading");
    }
}

function initEditModal() {
    const modal = document.querySelector("[data-occurrence-edit-modal]");
    if (!modal) return;

    modal.querySelector("[data-occurrence-edit-form]").addEventListener("submit", handleEditSubmit);

    // Só os botões fecham. Ao contrário do detalhe, aqui há texto digitado em
    // jogo: clique no fundo é fácil de dar sem querer e apagaria a edição em
    // andamento.
    modal.querySelectorAll("[data-modal-close]").forEach(button => {
        button.addEventListener("click", () => modal.close());
    });

    // Vale para as duas saídas — os botões e o Esc do <dialog>.
    modal.addEventListener("close", () => {
        editingId = null;
    });
}

/* =========================================================================
   Modal de exclusão (DELETE)
   ========================================================================= */

function openDeleteModal(occurrenceId) {
    const occurrence = occurrencesById.get(String(occurrenceId));
    if (!occurrence) return;

    const modal = document.querySelector("[data-occurrence-delete-modal]");

    // textContent: cooperado, tipo e observações vêm do banco e não podem ser
    // interpretados como marcação.
    modal.querySelector("[data-delete-question]").textContent =
        `Tem certeza que deseja excluir a ocorrência de ${occurrence.cooperativeMemberName}, `
        + `do tipo ${occurrence.occurrenceTypeName}, do dia ${formatDate(occurrence.occurrenceDate)}?`;

    modal.querySelector("[data-delete-excerpt]").textContent = buildExcerpt(occurrence.observations).text;

    showModalError(modal.querySelector("[data-delete-error]"), "");

    deletingId = occurrence.id;
    modal.showModal();
}

// Tira a ocorrência excluída da lista e redesenha. O DELETE responde 204, sem
// corpo: o que a tela sabe do registro é o que já estava em memória.
function removeOccurrence(occurrenceId) {
    allOccurrences = allOccurrences.filter(occurrence => occurrence.id !== occurrenceId);
    refreshOccurrences();
}

async function handleDeleteConfirm(event) {
    dismissNotifications();

    const confirmButton = event.currentTarget;
    const modal = confirmButton.closest("dialog");

    // Lido antes de qualquer await: o `close` do modal zera o deletingId, e o
    // toast de sucesso ainda precisa do nome do cooperado.
    const occurrence = occurrencesById.get(String(deletingId));
    if (!occurrence) return;

    const errorTarget = modal.querySelector("[data-delete-error]");
    showModalError(errorTarget, "");

    confirmButton.disabled = true;
    confirmButton.classList.add("is-loading");

    try {
        const response = await fetch(`${OCCURRENCES_URL}/${occurrence.id}`, {
            method: "DELETE",
            credentials: "same-origin",
        });

        if (response.status === 401) {
            window.location.href = "login";
            return;
        }

        if (!response.ok) {
            // 204 não tem corpo; o erro tem, e é o ApiError de sempre. É aqui
            // que cai a ocorrência já excluída por outra pessoa, com a mensagem
            // do service.
            const body = await response.json().catch(() => null);
            const message = body?.message || "Não foi possível excluir a ocorrência. Tente de novo.";

            notifyError(message);
            showModalError(errorTarget, message);
            return;
        }

        removeOccurrence(occurrence.id);
        modal.close();
        notifySuccess(`Ocorrência de ${occurrence.cooperativeMemberName} excluída.`);
    } catch (error) {
        const message = "Não foi possível conectar ao servidor. Tente de novo.";

        notifyError(message);
        showModalError(errorTarget, message);
        console.error(error);
    } finally {
        confirmButton.disabled = false;
        confirmButton.classList.remove("is-loading");
    }
}

function initDeleteModal() {
    const modal = document.querySelector("[data-occurrence-delete-modal]");
    if (!modal) return;

    modal.querySelector("[data-delete-confirm]").addEventListener("click", handleDeleteConfirm);

    // Nada de fechar por clique no fundo: o botão de confirmar é destrutivo e o
    // fundo fica logo ao lado dele.
    modal.querySelectorAll("[data-modal-close]").forEach(button => {
        button.addEventListener("click", () => modal.close());
    });

    modal.addEventListener("close", () => {
        deletingId = null;
    });
}

/* =========================================================================
   Ligação
   ========================================================================= */

/**
 * Um ouvinte só para a tabela inteira: as linhas são reescritas a cada filtro,
 * e ouvinte por botão morreria junto com a linha antiga.
 */
function initTableActions() {
    document.getElementById("tbodyOccurrences").addEventListener("click", event => {
        const editTrigger = event.target.closest("[data-edit-occurrence]");
        if (editTrigger) {
            openEditModal(editTrigger.dataset.editOccurrence);
            return;
        }

        const deleteTrigger = event.target.closest("[data-delete-occurrence]");
        if (deleteTrigger) {
            openDeleteModal(deleteTrigger.dataset.deleteOccurrence);
            return;
        }

        // Fora da coluna de ações, o clique em qualquer ponto da linha é pedido
        // de leitura.
        if (event.target.closest(".table__actions")) return;

        const row = event.target.closest("tr");
        if (!row) return;

        const trigger = row.querySelector("[data-view-occurrence]");
        if (trigger) openOccurrenceModal(trigger.dataset.viewOccurrence);
    });
}

function initFilters() {
    const filters = document.querySelector("[data-filters]");
    if (!filters) return;

    // Um ouvinte na barra inteira cobre os cinco campos: change basta para
    // select e para input[type=date], que só emitem com a escolha concluída.
    filters.addEventListener("change", applyFilters);

    document.querySelector("[data-clear-filters]").addEventListener("click", () => {
        Object.values(filterElements()).forEach(element => {
            element.value = "";
        });

        applyFilters();
    });

    syncDateBounds();
}

function init() {
    initFilters();
    initTableActions();
    initOccurrenceModal();
    initEditModal();
    initDeleteModal();
    loadOccurrences();
}

// Rodar tudo
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init(); // DOM já está pronto para rodar
}
