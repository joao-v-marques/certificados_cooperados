/**
 * Painel de controle: indicadores e tabela de cooperados no ano-base.
 *
 * Contrato com o HTML (data-*):
 *   [data-year-filter]  select de ano-base; trocar o valor recarrega o relatório
 *   [data-empty-state]  bloco de vazio, com [data-empty-title] e [data-empty-text]
 *   [data-table-count]  rodapé com a contagem de linhas mostradas
 *
 * Por id: tbodyCooperativeMembers, cardCooperativeMembersQtd,
 * cardMembersWithoutCoursesQtd, cardMembersGoalReachedQtd,
 * filtro-busca / filtro-status / filtro-ordenacao.
 *
 * Divisão de trabalho: o ano-base vai ao servidor, porque muda a agregação de
 * cursos e pontos; busca, status e ordenação são aplicados aqui sobre o que já
 * veio, sem nova requisição.
 *
 * O erro de carregamento sai em toast (ver utils/notyf.js).
 */

import {notifyError} from "../utils/notyf.js";

const API_URL = "/certificados-cooperados/api/v1/cooperative-members/annual-report";

/** Atraso entre a digitação e a filtragem, para não refiltrar a cada tecla. */
const SEARCH_DEBOUNCE_MS = 250;

/**
 * Último relatório recebido. Os filtros de tela leem daqui, e não do DOM, para
 * a ordenação não depender do que está renderizado no momento.
 */
let report = null;

/* =========================================================================
   Texto
   ========================================================================= */

// Nome e e-mail são digitados pelo usuário e voltam da API, então não podem ser
// interpolados crus em innerHTML.
function escapeHtml(value) {
    const characters = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"};
    return String(value ?? "").replace(/[&<>"']/g, character => characters[character]);
}

// Busca sem acento e sem caixa: "jose" acha "José".
function normalize(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase();
}

/* =========================================================================
   Filtros de tela
   ========================================================================= */

function readFilters() {
    return {
        search: normalize(document.getElementById("filtro-busca").value.trim()),
        status: document.getElementById("filtro-status").value,
        order: document.getElementById("filtro-ordenacao").value,
    };
}

function applyFilters(members) {
    const {search, status, order} = readFilters();

    let rows = members;

    if (search) {
        rows = rows.filter(member =>
            normalize(member.name).includes(search) || normalize(member.email).includes(search));
    }

    if (status === "atingiu") {
        rows = rows.filter(member => member.goalReached);
    } else if (status === "pendente") {
        rows = rows.filter(member => !member.goalReached);
    }

    // Cópia antes de ordenar: sort() é destrutivo e `members` é o relatório
    // guardado, que os outros filtros ainda vão reler.
    rows = [...rows];

    if (order === "pontos-desc") {
        rows.sort((a, b) => b.totalPoints - a.totalPoints || a.name.localeCompare(b.name, "pt-BR"));
    } else if (order === "pontos-asc") {
        rows.sort((a, b) => a.totalPoints - b.totalPoints || a.name.localeCompare(b.name, "pt-BR"));
    } else {
        rows.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }

    return rows;
}

/* =========================================================================
   Renderização
   ========================================================================= */

function renderEmptyState(hasRows, hasMembers) {
    const emptyState = document.querySelector("[data-empty-state]");

    emptyState.hidden = hasRows;
    if (hasRows) return;

    const title = emptyState.querySelector("[data-empty-title]");
    const text = emptyState.querySelector("[data-empty-text]");

    // Vazio por filtro e vazio por base sem cadastro são situações diferentes;
    // a mesma frase para as duas faria o usuário procurar cooperado que existe.
    if (hasMembers) {
        title.textContent = "Nenhum cooperado encontrado";
        text.textContent = "Nenhum cooperado atende aos filtros aplicados. Ajuste a busca ou o status.";
    } else {
        title.textContent = "Nenhum cooperado cadastrado ainda";
        text.textContent = "Os cooperados cadastrados no sistema aparecem aqui, com o progresso deles na meta anual de pontos.";
    }
}

function renderTable(rows) {
    const tbody = document.getElementById("tbodyCooperativeMembers");
    const fragment = document.createDocumentFragment();

    rows.forEach(member => {
        const badgeClass = member.goalReached ? "badge--success" : "badge--warning";
        const badgeLabel = member.goalReached ? "Meta atingida" : "Pendente";

        const tr = document.createElement("tr");

        // O e-mail é opcional: sem ele a segunda linha do nome fica vazia.
        // TODO: preencher a coluna de ações quando existir a tela de detalhe do
        // cooperado; até lá a célula fica vazia em vez de exibir botão inerte.
        tr.innerHTML = `
            <td data-label="Cooperado">
                <span class="table__primary">${escapeHtml(member.name)}</span>
                <span class="table__secondary">${escapeHtml(member.email)}</span>
            </td>
            <td data-label="Cursos no ano" class="table__num tabular">${member.totalCourses}</td>
            <td data-label="Pontos no ano" class="table__num tabular">${member.totalPoints}</td>
            <td data-label="Status">
                <span class="badge ${badgeClass}">${badgeLabel}</span>
            </td>
            <td class="table__actions"></td>
        `;

        fragment.appendChild(tr);
    });

    tbody.innerHTML = ``;
    tbody.appendChild(fragment);
}

function renderCount(shown, total) {
    const counter = document.querySelector("[data-table-count]");

    if (total === 0) {
        counter.textContent = "Nenhum cooperado para mostrar";
        return;
    }

    counter.textContent = (shown === total)
        ? `${total} ${total === 1 ? "cooperado" : "cooperados"}`
        : `${shown} de ${total} cooperados`;
}

function renderIndicators() {
    document.getElementById("cardCooperativeMembersQtd").textContent = report.totalMembers;
    document.getElementById("cardMembersWithoutCoursesQtd").textContent = report.membersWithoutCourses;
    document.getElementById("cardMembersGoalReachedQtd").textContent = report.membersWhoReachedGoal;
}

// Reaplica filtros e redesenha a tabela a partir do relatório em memória.
function refreshTable() {
    if (!report) return;

    const rows = applyFilters(report.members);

    renderTable(rows);
    renderEmptyState(rows.length > 0, report.members.length > 0);
    renderCount(rows.length, report.members.length);
}

// As opções vêm do backend (anos com curso concluído + o ano corrente), por isso
// são reescritas a cada carga: um lançamento novo pode ter criado um ano.
function renderYearOptions() {
    const select = document.querySelector("[data-year-filter]");

    select.innerHTML = ``;

    report.availableYears.forEach(year => {
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        option.selected = (year === report.year);
        select.appendChild(option);
    });
}

/* =========================================================================
   Carregamento
   ========================================================================= */

async function loadReport(year) {
    const select = document.querySelector("[data-year-filter]");

    // Evita que dois anos sejam pedidos ao mesmo tempo e a resposta mais lenta
    // sobrescreva a mais recente.
    select.disabled = true;

    try {
        const url = (year != null) ? `${API_URL}?year=${year}` : API_URL;
        const response = await fetch(url, {credentials: "same-origin"});

        // Sessão expirada volta para o login em vez de virar "não foi possível
        // carregar".
        if (response.status === 401) {
            window.location.href = "login";
            return;
        }

        if (!response.ok) {
            throw new Error(`A API respondeu ${response.status}`);
        }

        report = await response.json();

        renderYearOptions();
        renderIndicators();
        refreshTable();
    } catch (error) {
        // Falha de rede não é "nenhum cooperado cadastrado": o bloco de vazio
        // continua oculto e os indicadores seguem com "-", para a tela não
        // afirmar que o ano não teve lançamento.
        document.querySelector("[data-empty-state]").hidden = true;

        notifyError("Não foi possível carregar o painel do ano selecionado. Atualize a página.");
        console.error(error);
    } finally {
        select.disabled = false;
    }
}

/* =========================================================================
   Ligação
   ========================================================================= */

function initFilters() {
    document.querySelector("[data-year-filter]")
        .addEventListener("change", event => loadReport(event.currentTarget.value));

    let searchTimer;
    document.getElementById("filtro-busca").addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(refreshTable, SEARCH_DEBOUNCE_MS);
    });

    document.getElementById("filtro-status").addEventListener("change", refreshTable);
    document.getElementById("filtro-ordenacao").addEventListener("change", refreshTable);
}

function init() {
    initFilters();

    // Sem ano: o backend assume o corrente, que é o que a tela abre por padrão.
    loadReport(null);
}

// Rodar tudo
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init(); // DOM já está pronto para rodar
}
