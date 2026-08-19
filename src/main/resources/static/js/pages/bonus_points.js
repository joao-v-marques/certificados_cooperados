/**
 * Matriz da pontuação premiada: uma linha por cooperado ativo, uma coluna por
 * evento do ano.
 *
 * Endpoint (sob o context-path da aplicação):
 *   GET /api/v1/bonus-points/report?year=   cabeçalho, colunas, linhas e faixas
 *
 * Tudo vem dessa chamada só, de propósito: indicadores, colunas e linhas são
 * recortes do mesmo ano, e separar em duas chamadas abriria a chance de a tela
 * mostrar cabeçalho de um ano e matriz de outro.
 *
 * A tela não calcula nada além de médias de exibição. Percentual, faixa e total
 * possível chegam prontos do backend — a régua das faixas é regra de negócio da
 * PointsBandPolicy, e duplicá-la aqui garantiria divergência na primeira vez que
 * ela mudasse. Os limites da legenda também vêm da resposta, pelo mesmo motivo.
 *
 * Contrato com o HTML (data-*):
 *   [data-year-filter]     select do ano-base, escopa a tela inteira
 *   [data-report]          bloco da matriz inteira, oculto até a carga terminar
 *   [data-empty-state]     bloco de "nenhum cooperado ativo"
 *   [data-kpi-*]           os quatro indicadores do topo
 *   [data-band-legend]     <ul> da legenda de faixas
 *   [data-matrix-head]     <tr> do cabeçalho da matriz
 *   [data-matrix-body]     <tbody> da matriz
 *   [data-matrix-caption]  linha de apoio do card
 *   [data-no-events-note]  aviso de ano sem evento cadastrado
 *   [data-table-count]     rodapé com a contagem
 *   [data-table-filters]   barra de filtros da matriz; qualquer mudança refiltra
 *   [data-filter-clear]    zera os quatro campos de uma vez
 */

import {notifyError} from "../utils/notyf.js";

const REPORT_URL = "/certificados-cooperados/api/v1/bonus-points/report";

/** Ano-base em vigor na tela. */
let currentYear = new Date().getFullYear();

/** Resposta do ano em vigor, guardada para os filtros refazerem a matriz sem
 *  nova chamada à API a cada campo trocado. */
let currentReport = null;

/* =========================================================================
   Texto vindo do banco
   ========================================================================= */

/** O nome do cooperado e o do evento vêm do cadastro: não podem virar marcação. */
function escapeHtml(value) {
    const characters = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"};
    return String(value ?? "").replace(/[&<>"']/g, character => characters[character]);
}

function formatDate(isoDate) {
    if (!isoDate) return "";
    const [, month, day] = String(isoDate).split("-");
    return `${day}/${month}`;
}

/* =========================================================================
   Chamada à API
   ========================================================================= */

async function apiRequest(url) {
    const response = await fetch(url, {credentials: "same-origin"});

    if (response.status === 401) {
        window.location.href = "login";
        return null;
    }

    const parsed = await response.json().catch(() => null);

    return {ok: response.ok, status: response.status, body: parsed};
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

function updateSummary(report) {
    const members = report.members ?? [];

    document.querySelector("[data-kpi-max]").textContent = report.maxPossiblePoints;
    document.querySelector("[data-kpi-max-note]").textContent =
        `${report.totalEventPoints} em eventos + ${report.annualGoalPoints} da meta de cursos.`;

    document.querySelector("[data-kpi-members]").textContent = report.totalMembers;
    document.querySelector("[data-kpi-members-note]").textContent =
        `${report.events?.length ?? 0} evento(s) premiado(s) no ano.`;

    // Média simples do percentual de cada um: é o que a diretoria pergunta.
    const average = members.length
        ? Math.round(members.reduce((sum, member) => sum + member.percentage, 0) / members.length)
        : 0;

    document.querySelector("[data-kpi-average]").textContent = `${average}%`;

    const zero = members.filter(member => member.totalPoints === 0).length;

    document.querySelector("[data-kpi-zero]").textContent = zero;
    document.querySelector("[data-kpi-zero-note]").textContent =
        zero === 0
            ? "Todos já somaram algum ponto."
            : "Sem nenhum curso nem evento no ano.";
}

/* =========================================================================
   Legenda das faixas
   ========================================================================= */

/** Nome de cada faixa por cor, na ordem definida pela PointsBandPolicy. */
const BAND_NAMES = {1: "Preta", 2: "Roxa", 3: "Vermelha", 4: "Amarela", 5: "Verde"};

function bandLabel(band) {
    return `Faixa ${BAND_NAMES[band] ?? band}`;
}

function renderBandLegend(report) {
    const legend = document.querySelector("[data-band-legend]");
    const members = report.members ?? [];

    legend.innerHTML = (report.bands ?? [])
        .map(band => {
            const count = members.filter(member => member.band === band.band).length;
            const label = count === 1 ? "1 cooperado" : `${count} cooperados`;

            return `
                <li class="band-legend__item band-legend__item--${band.band}">
                    <span class="band-legend__range">${band.lowerBoundPercent}% a ${band.upperBoundPercent}%</span>
                    <span class="band-legend__name">${bandLabel(band.band)}</span>
                    <span class="band-legend__count">${label}</span>
                </li>
            `;
        })
        .join("");
}

/* =========================================================================
   Filtros da matriz
   ========================================================================= */

const filterElements = () => ({
    name: document.getElementById("filtro-nome"),
    band: document.getElementById("filtro-faixa"),
    event: document.getElementById("filtro-evento"),
    participation: document.getElementById("filtro-participacao"),
});

function readFilters() {
    const elements = filterElements();

    return {
        name: elements.name.value.trim().toLowerCase(),
        band: elements.band.value,
        event: elements.event.value,
        participation: elements.participation.value,
    };
}

const hasActiveFilters = filters => Object.values(filters).some(value => value !== "");

/**
 * Participação só faz sentido com um evento escolhido: sem isso o campo
 * fica desabilitado e limpo, para não sugerir um filtro que não filtra nada.
 */
function syncParticipationAvailability() {
    const elements = filterElements();
    const hasEvent = elements.event.value !== "";

    elements.participation.disabled = !hasEvent;
    if (!hasEvent) elements.participation.value = "";
}

/** Substitui as opções de um select preservando a escolha atual, se ela
 *  ainda existir na nova lista — senão o filtro voltaria sozinho para
 *  "todos" a cada troca de ano. */
function fillFilterSelect(select, pairs) {
    const placeholder = select.querySelector("option");
    const previous = select.value;

    select.innerHTML = "";
    select.appendChild(placeholder);

    pairs.forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
    });

    select.value = [...select.options].some(option => option.value === previous) ? previous : "";
}

function populateBandFilter(bands) {
    fillFilterSelect(
        document.getElementById("filtro-faixa"),
        (bands ?? []).map(band => [String(band.band), bandLabel(band.band)]),
    );
}

function populateEventFilter(events) {
    fillFilterSelect(
        document.getElementById("filtro-evento"),
        (events ?? []).map(event => [String(event.id), event.name]),
    );
}

function filterMembers(members, filters) {
    return members.filter(member => {
        if (filters.name && !member.name.toLowerCase().includes(filters.name)) return false;
        if (filters.band && String(member.band) !== filters.band) return false;

        if (filters.event) {
            const participated = new Set(member.participatedEventIds ?? []).has(Number(filters.event));
            if (filters.participation === "sim" && !participated) return false;
            if (filters.participation === "nao" && participated) return false;
        }

        return true;
    });
}

function applyFilters() {
    if (!currentReport) return;

    syncParticipationAvailability();

    const filters = readFilters();
    const filtering = hasActiveFilters(filters);

    document.querySelector("[data-filter-clear]").disabled = !filtering;

    const allMembers = currentReport.members ?? [];
    const filteredMembers = filterMembers(allMembers, filters);

    renderMatrixBody(currentReport, filteredMembers, filtering);
}

/* =========================================================================
   Matriz
   ========================================================================= */

function renderHead(events) {
    const head = document.querySelector("[data-matrix-head]");

    // O nome vai dentro de um <span> porque é ele que carrega o teto de largura:
    // max-width na própria célula tem comportamento indefinido em tabela.
    const eventColumns = events
        .map(event => `
            <th scope="col" class="matrix__event">
                <span class="matrix__event-name">${escapeHtml(event.name)}</span>
                <span class="matrix__event-points">${formatDate(event.eventDate)} · ${event.points} pts</span>
            </th>
        `)
        .join("");

    // matrix__num, e não o table__num do componente: aqui o cabeçalho acompanha
    // o valor, que a matriz centraliza.
    head.innerHTML = `
        <th scope="col">Cooperado</th>
        <th scope="col" class="matrix__num">Cursos</th>
        ${eventColumns}
        <th scope="col" class="matrix__num">Total</th>
        <th scope="col" class="matrix__num">%</th>
        <th scope="col" class="matrix__num">Faixa</th>
    `;
}

function buildRow(member, events) {
    const row = document.createElement("tr");

    // A resposta manda os ids em que houve participação, e não uma célula por
    // evento: com 200 cooperados e 6 eventos seriam 1200 células quase vazias.
    const participated = new Set(member.participatedEventIds ?? []);

    const eventCells = events
        .map(event => participated.has(event.id)
            ? `<td class="matrix__cell matrix__hit" data-label="${escapeHtml(event.name)}">${event.points}</td>`
            : `<td class="matrix__cell matrix__miss" data-label="${escapeHtml(event.name)}">—</td>`)
        .join("");

    // A coluna do nome tem largura limitada e corta com reticências, então o nome
    // inteiro precisa continuar alcançável pelo title. O teto vive no <span>, e
    // não na célula, pelo mesmo motivo do cabeçalho de evento.
    row.innerHTML = `
        <th scope="row" title="${escapeHtml(member.name)}"><span class="matrix__member-name">${escapeHtml(member.name)}</span></th>
        <td class="matrix__cell" data-label="Cursos">${member.coursePoints}</td>
        ${eventCells}
        <td class="matrix__cell matrix__total" data-label="Total">${member.totalPoints}</td>
        <td class="matrix__cell matrix__total" data-label="Percentual">${member.percentage}%</td>
        <td class="matrix__cell" data-label="Faixa"><span class="band band--${member.band}">${bandLabel(member.band)}</span></td>
    `;

    return row;
}

/**
 * Corpo da matriz para o recorte atual dos filtros. Cabeçalho, legenda e
 * indicadores continuam falando do ano inteiro — só a lista de cooperados
 * é que se estreita.
 */
function renderMatrixBody(report, filteredMembers, filtering) {
    const body = document.querySelector("[data-matrix-body]");
    const events = report.events ?? [];
    const allMembers = report.members ?? [];

    body.innerHTML = "";

    if (filteredMembers.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.className = "matrix__empty-row";
        cell.colSpan = events.length + 5;
        cell.textContent = "Nenhum cooperado corresponde aos filtros.";
        row.appendChild(cell);
        body.appendChild(row);
    } else {
        const fragment = document.createDocumentFragment();
        filteredMembers.forEach(member => fragment.appendChild(buildRow(member, events)));
        body.appendChild(fragment);
    }

    document.querySelector("[data-table-count]").textContent = filtering
        ? `${filteredMembers.length} de ${allMembers.length} cooperados`
        : (allMembers.length === 1 ? "1 cooperado ativo" : `${allMembers.length} cooperados ativos`);
}

function renderMatrix(report) {
    const events = report.events ?? [];

    renderHead(events);

    document.querySelector("[data-matrix-caption]").textContent =
        `Percentual sobre os ${report.maxPossiblePoints} pontos possíveis em ${report.year}.`;

    // Ano sem evento continua sendo uma matriz válida, só que com a coluna de
    // cursos sozinha. Sem o aviso, pareceria defeito.
    document.querySelector("[data-no-events-note]").hidden = events.length > 0;

    populateEventFilter(events);
    applyFilters();
}

/* =========================================================================
   Carga
   ========================================================================= */

async function loadReport() {
    const reportBlock = document.querySelector("[data-report]");
    const emptyState = document.querySelector("[data-empty-state]");

    try {
        const result = await apiRequest(`${REPORT_URL}?year=${currentYear}`);
        if (!result) return;

        if (!result.ok) {
            throw new Error(result.body?.message || `A API respondeu ${result.status}`);
        }

        const report = result.body;
        currentReport = report;

        fillYearFilter(report.availableYears);

        const hasMembers = (report.members ?? []).length > 0;

        // Só agora, com a resposta em mãos, dá para afirmar que não há cooperado
        // ativo nenhum.
        emptyState.hidden = hasMembers;
        reportBlock.hidden = !hasMembers;

        if (!hasMembers) return;

        updateSummary(report);
        renderBandLegend(report);
        populateBandFilter(report.bands);
        renderMatrix(report);
    } catch (error) {
        // Falha de rede não é "nenhum cooperado cadastrado": os dois blocos
        // continuam ocultos para a tela não mentir sobre o estado do cadastro.
        currentReport = null;
        emptyState.hidden = true;
        reportBlock.hidden = true;

        notifyError("Não foi possível carregar a matriz de pontuação. Atualize a página.");
        console.error(error);
    }
}

/* =========================================================================
   Ligação
   ========================================================================= */

function initYearFilter() {
    const select = document.querySelector("[data-year-filter]");
    if (!select) return;

    select.addEventListener("change", () => {
        currentYear = Number(select.value);
        loadReport();
    });
}

function initFilters() {
    const filters = document.querySelector("[data-table-filters]");
    if (!filters) return;

    // Um ouvinte na barra inteira cobre os quatro campos: "input" pega a busca
    // por nome a cada tecla, "change" pega os três selects.
    filters.addEventListener("input", applyFilters);
    filters.addEventListener("change", applyFilters);

    document.querySelector("[data-filter-clear]").addEventListener("click", () => {
        Object.values(filterElements()).forEach(element => {
            element.value = "";
        });

        applyFilters();
    });
}

function init() {
    initYearFilter();
    initFilters();
    loadReport();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
