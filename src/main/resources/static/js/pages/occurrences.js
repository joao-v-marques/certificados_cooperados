/**
 * Listagem de ocorrências: preenche a tabela, filtra e abre o detalhe de cada uma.
 *
 * Contrato com o HTML (data-*):
 *   [data-filters]            barra de filtros; qualquer mudança refiltra
 *   [data-clear-filters]      zera os cinco campos de uma vez
 *   [data-empty-state]        bloco de vazio, com [data-empty-title] e [data-empty-text]
 *   [data-table-count]        rodapé com a contagem de linhas mostradas
 *   [data-view-occurrence]    gatilho do detalhe; o valor é o id da ocorrência
 *
 * Modal de detalhe, dentro de [data-occurrence-modal]:
 *   [data-modal-close]        fecha
 *   [data-detail-member] / -type / -date / -inserted-by / -created-at
 *   [data-detail-observations]
 *
 * Por id: tbodyOccurrences, cardOccurrencesQtd, filtro-cooperado, filtro-tipo,
 * filtro-lancado-por, filtro-data-de e filtro-data-ate.
 *
 * Tudo — filtro e detalhe — acontece sobre a lista que GET /api/v1/occurrences
 * já trouxe. O endpoint não recebe parâmetro de busca, e enquanto o volume for
 * o de uma secretaria executiva filtrar no navegador é mais rápido que ir ao
 * servidor a cada campo. Quando a base crescer a ponto de pesar, o caminho é
 * mover estes mesmos filtros para query params no OccurrenceController.
 */

import {notifyError} from "../utils/notyf.js";

const OCCURRENCES_URL = "/certificados-cooperados/api/v1/occurrences";

/** Quantos caracteres da observação vão para a célula. O corte visual é do CSS
 *  (-webkit-line-clamp); este aqui evita despejar 2000 caracteres por linha no
 *  DOM só para escondê-los em seguida. */
const EXCERPT_LENGTH = 200;

/** Tudo que a API devolveu, na ordem em que veio. É a fonte dos filtros. */
let allOccurrences = [];

/** Ocorrências por id, para o modal abrir sem nova consulta. */
const occurrencesById = new Map();

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
            <button type="button" class="btn-icon occurrences-table__action" disabled
                    title="A edição de ocorrência ainda não está disponível">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M9.5 3 13 6.5 5.5 14H2v-3.5L9.5 3Z" stroke="currentColor"
                          stroke-width="1.4" stroke-linejoin="round"/>
                </svg>
                <span class="visually-hidden">Editar ocorrência</span>
            </button>
            <button type="button" class="btn-icon occurrences-table__action" disabled
                    title="A exclusão de ocorrência ainda não está disponível">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M2.5 4.5h11M6.5 4.5V3h3v1.5M4.5 4.5 5 13.5h6l.5-9" stroke="currentColor"
                          stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span class="visually-hidden">Excluir ocorrência</span>
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

        occurrencesById.clear();
        allOccurrences.forEach(occurrence => occurrencesById.set(String(occurrence.id), occurrence));

        // O card conta o total lançado, e não o que sobrou do filtro: é o número
        // do sistema, não da consulta em curso. O recorte fica no rodapé.
        card.textContent = allOccurrences.length;

        populateFilterOptions(allOccurrences);
        applyFilters();
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

    // Delegação: as linhas são reescritas a cada filtro, e ouvinte por botão
    // morreria junto com a linha antiga.
    document.getElementById("tbodyOccurrences").addEventListener("click", event => {
        // A coluna de ações tem os botões de editar e excluir; clique ali não é
        // pedido de leitura, mesmo enquanto eles estão desabilitados.
        if (event.target.closest(".table__actions")) return;

        const row = event.target.closest("tr");
        if (!row) return;

        const trigger = row.querySelector("[data-view-occurrence]");
        if (trigger) openOccurrenceModal(trigger.dataset.viewOccurrence);
    });

    modal.addEventListener("click", event => {
        // Clique que cai no próprio <dialog> é clique no fundo: o conteúdo
        // cobre toda a área do painel.
        if (event.target === modal || event.target.closest("[data-modal-close]")) {
            modal.close();
        }
    });
}

/* =========================================================================
   Ligação
   ========================================================================= */

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
    initOccurrenceModal();
    loadOccurrences();
}

// Rodar tudo
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init(); // DOM já está pronto para rodar
}
