/**
 * Painel de controle: indicadores e tabela de cooperados no ano-base.
 *
 * Contrato com o HTML (data-*):
 *   [data-year-filter]  select de ano-base; trocar o valor recarrega o relatório
 *   [data-empty-state]  bloco de vazio, com [data-empty-title] e [data-empty-text]
 *   [data-table-count]  rodapé com a contagem de linhas mostradas
 *   [data-view-member]  botão da linha que abre o detalhe; o valor é o id do cooperado
 *
 * Modal de detalhe, dentro de [data-member-modal]:
 *   [data-modal-close]              fecha
 *   [data-member-name] / -email / -status / -created-at
 *   [data-member-total-courses] / -total-hours / -total-points / -year
 *   [data-member-courses]           tbody da lista de cursos do ano
 *   [data-member-courses-empty]     texto de "nenhum curso no ano"
 *   [data-download-certificates]    baixa o zip do cooperado no ano
 *   [data-download-certificate]     baixa um certificado; o valor é o id dele
 *
 * Divisão de trabalho: o ano-base vai ao servidor, porque muda a agregação de
 * cursos e pontos; busca, status e ordenação são aplicados aqui sobre o que já
 * veio, sem nova requisição. O detalhe do modal é sempre uma consulta nova, e
 * não um recorte do relatório em memória: ele mostra dado que a tabela não tem
 * (os cursos) e não deve ficar preso a um relatório carregado minutos antes.
 *
 * O erro de carregamento sai em toast (ver utils/notyf.js).
 */

import {notifyError} from "../utils/notyf.js";

const API_URL = "/certificados-cooperados/api/v1/cooperative-members/annual-report";
const MEMBERS_URL = "/certificados-cooperados/api/v1/cooperative-members";
const CERTIFICATES_URL = "/certificados-cooperados/api/v1/certificates";

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

/**
 * Data em pt-BR, aceitando tanto o dia puro quanto o instante completo.
 *
 * O completionDate chega como LocalDate ("2025-03-14"). Passar essa string por
 * `new Date` a lê como meia-noite em UTC e, no fuso do Brasil, o dia volta um —
 * o curso concluído no dia 14 apareceria como 13. Por isso a data-só é montada
 * no texto; só o createdAt, que é instante de verdade, passa por Date.
 */
function formatDate(value) {
    if (!value) return "—";

    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-BR");
}

/**
 * Carga horária em h:mm a partir dos minutos.
 *
 * O curso é lançado em minutos e o backend soma em minutos, mas quem lê o painel
 * pensa em hora: 1680 diz muito menos do que 28:00. A conversão fica só na
 * exibição — o total continua chegando em minuto, que é a unidade que a regra de
 * pontos usa.
 */
function formatHours(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours}:${String(minutes).padStart(2, "0")}`;
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
        //
        // O id do cooperado vai em data-view-member: é por ele que o clique
        // delegado (initMemberModal) sabe qual detalhe abrir.
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
            <td class="table__actions">
                <button type="button" class="btn-link" data-view-member="${member.id}"
                        aria-label="Visualizar ${escapeHtml(member.name)}">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M1.5 8s2.4-4 6.5-4 6.5 4 6.5 4-2.4 4-6.5 4-6.5-4-6.5-4Z"
                              stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                        <circle cx="8" cy="8" r="1.75" stroke="currentColor" stroke-width="1.3"/>
                    </svg>
                    Visualizar
                </button>
            </td>
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
   Download de certificado

   Tudo passa por fetch, e não por link direto, por dois motivos: o 401 de
   sessão vencida vira volta para o login em vez de página de erro, e a
   mensagem de negócio da API ("Nenhum certificado disponível…") chega como
   toast em vez de aparecer como JSON cru na aba do navegador.
   ========================================================================= */

/**
 * O nome do arquivo que o servidor mandou no Content-Disposition.
 *
 * O `filename*` codificado vem primeiro porque é ele que preserva acento — o
 * `filename=` simples fica como reserva para quando não houver.
 */
function filenameOf(response) {
    const header = response.headers.get("Content-Disposition") ?? "";

    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
    if (encoded) return decodeURIComponent(encoded[1]);

    const plain = /filename="([^"]+)"/i.exec(header);
    return plain ? plain[1] : "certificado";
}

function saveBlob(blob, filename) {
    const objectUrl = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    // Revogar no mesmo instante do clique cancela o download em alguns
    // navegadores: a URL precisa sobreviver até eles pegarem os bytes.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function downloadFile(url, trigger, failureMessage) {
    trigger.disabled = true;
    trigger.classList.add("is-loading");

    try {
        const response = await fetch(url, {credentials: "same-origin"});

        if (response.status === 401) {
            window.location.href = "login";
            return;
        }

        if (!response.ok) {
            // O corpo de erro da API é sempre o ApiError { message, fields }.
            const error = await response.json().catch(() => null);

            notifyError(error?.message ?? failureMessage);
            return;
        }

        saveBlob(await response.blob(), filenameOf(response));
    } catch (error) {
        notifyError(failureMessage);
        console.error(error);
    } finally {
        trigger.disabled = false;
        trigger.classList.remove("is-loading");
    }
}

/* =========================================================================
   Modal de detalhe do cooperado
   ========================================================================= */

/**
 * Cooperado e ano do modal aberto, guardados porque o botão do zip precisa dos
 * dois para montar a URL. Vem do que a resposta afirmou, e não do select da
 * página: trocar o ano-base com o modal aberto não pode fazer o zip baixar um
 * ano diferente do que está listado ali dentro.
 */
let openMember = null;

function renderMemberCourses(courses) {
    const tbody = document.querySelector("[data-member-courses]");
    const emptyState = document.querySelector("[data-member-courses-empty]");
    const downloadAll = document.querySelector("[data-download-certificates]");

    emptyState.hidden = courses.length > 0;

    // Sem nenhum arquivo não há zip a montar: o endpoint recusaria, então o
    // botão já nasce impedido em vez de oferecer um download que volta em erro.
    downloadAll.disabled = !courses.some(course => course.certificateId != null);

    tbody.innerHTML = courses.map(course => {
        // Curso sem certificado é possível no schema, ainda que o lançamento
        // sempre grave um: a linha diz isso em vez de exibir um botão morto.
        const certificate = (course.certificateId != null)
            ? `<button type="button" class="btn-link" data-download-certificate="${course.certificateId}"
                       aria-label="Baixar o certificado de ${escapeHtml(course.title)}">Certificado</button>`
            : `<span class="text-muted">Sem certificado</span>`;

        return `
            <tr>
                <td data-label="Curso"><span class="table__primary">${escapeHtml(course.title)}</span></td>
                <td data-label="Concluído em">${formatDate(course.completionDate)}</td>
                <td data-label="Minutos" class="table__num tabular">${course.totalMinutes}</td>
                <td data-label="Pontos" class="table__num tabular">${course.points}</td>
                <td class="table__actions">${certificate}</td>
            </tr>
        `;
    }).join("");
}

function renderMemberDetail(detail) {
    const status = document.querySelector("[data-member-status]");

    document.querySelector("[data-member-name]").textContent = detail.name;
    // O e-mail é opcional no cadastro; sem ele a linha diz isso, em vez de
    // ficar em branco e parecer campo que não carregou.
    document.querySelector("[data-member-email]").textContent = detail.email ?? "Sem e-mail cadastrado";

    status.textContent = detail.active ? "Ativo" : "Inativo";
    status.className = `badge ${detail.active ? "badge--success" : "badge--negative"}`;

    document.querySelector("[data-member-created-at]").textContent = formatDate(detail.createdAt);
    document.querySelector("[data-member-total-courses]").textContent = detail.totalCourses;
    document.querySelector("[data-member-total-hours]").textContent = formatHours(detail.totalMinutes);
    // A meta anda junto do total: 20 pontos só quer dizer alguma coisa ao lado
    // dos 30 que a cooperativa cobra.
    document.querySelector("[data-member-total-points]").textContent = `${detail.totalPoints} / ${detail.goalPoints}`;
    document.querySelector("[data-member-year]").textContent = detail.year;

    renderMemberCourses(detail.courses);
}

async function openMemberModal(memberId, trigger) {
    const modal = document.querySelector("[data-member-modal]");

    trigger.disabled = true;

    try {
        const response = await fetch(`${MEMBERS_URL}/${memberId}/annual-report?year=${report.year}`,
            {credentials: "same-origin"});

        if (response.status === 401) {
            window.location.href = "login";
            return;
        }

        if (!response.ok) {
            throw new Error(`A API respondeu ${response.status}`);
        }

        const detail = await response.json();

        renderMemberDetail(detail);
        openMember = {id: detail.id, year: detail.year};

        modal.showModal();
    } catch (error) {
        notifyError("Não foi possível abrir o detalhe deste cooperado. Tente de novo.");
        console.error(error);
    } finally {
        trigger.disabled = false;
    }
}

function initMemberModal() {
    const modal = document.querySelector("[data-member-modal]");

    // Delegação: as linhas da tabela são reescritas a cada filtro, e ouvinte
    // por botão morreria junto com a linha antiga.
    document.getElementById("tbodyCooperativeMembers").addEventListener("click", event => {
        const trigger = event.target.closest("[data-view-member]");
        if (!trigger) return;

        openMemberModal(trigger.dataset.viewMember, trigger);
    });

    modal.addEventListener("click", event => {
        // Clique que cai no próprio <dialog> é clique no fundo: o conteúdo
        // cobre toda a área do painel.
        if (event.target === modal || event.target.closest("[data-modal-close]")) {
            modal.close();
            return;
        }

        const downloadAll = event.target.closest("[data-download-certificates]");
        if (downloadAll) {
            downloadFile(`${MEMBERS_URL}/${openMember.id}/certificates?year=${openMember.year}`,
                downloadAll,
                "Não foi possível baixar os certificados. Tente de novo.");
            return;
        }

        const downloadOne = event.target.closest("[data-download-certificate]");
        if (downloadOne) {
            downloadFile(`${CERTIFICATES_URL}/${downloadOne.dataset.downloadCertificate}`,
                downloadOne,
                "Não foi possível baixar este certificado. Tente de novo.");
        }
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
    initMemberModal();

    // Sem ano: o backend assume o corrente, que é o que a tela abre por padrão.
    loadReport(null);
}

// Rodar tudo
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init(); // DOM já está pronto para rodar
}
