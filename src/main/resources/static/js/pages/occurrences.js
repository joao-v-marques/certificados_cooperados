/**
 * Listagem de ocorrências: preenche a tabela e abre o detalhe de cada uma.
 *
 * Contrato com o HTML (data-*):
 *   [data-empty-state]        bloco de "nenhuma ocorrência lançada"
 *   [data-table-count]        rodapé com a contagem de linhas
 *   [data-view-occurrence]    gatilho do detalhe; o valor é o id da ocorrência
 *
 * Modal de detalhe, dentro de [data-occurrence-modal]:
 *   [data-modal-close]        fecha
 *   [data-detail-member] / -type / -date / -inserted-by / -created-at
 *   [data-detail-observations]
 *
 * Por id: tbodyOccurrences e cardOccurrencesQtd.
 *
 * O modal não chama a API: GET /api/v1/occurrences já devolve as observações
 * inteiras, então o detalhe é montado com o que a listagem trouxe. Abrir um
 * texto que já está na memória não justifica uma ida ao servidor.
 */

import {notifyError} from "../utils/notyf.js";

const OCCURRENCES_URL = "/certificados-cooperados/api/v1/occurrences";

/** Quantos caracteres da observação vão para a célula. O corte visual é do CSS
 *  (-webkit-line-clamp); este aqui evita despejar 2000 caracteres por linha no
 *  DOM só para escondê-los em seguida. */
const EXCERPT_LENGTH = 200;

/** Ocorrências carregadas, por id, para o modal abrir sem nova consulta. */
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

async function populateOccurrencesTable() {
    const tbody = document.getElementById("tbodyOccurrences");
    const emptyState = document.querySelector("[data-empty-state]");
    const countTarget = document.querySelector("[data-table-count]");
    const card = document.getElementById("cardOccurrencesQtd");

    tbody.innerHTML = ``;
    occurrencesById.clear();

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
        const occurrences = Array.isArray(responseJSON) ? responseJSON : [];

        const fragment = document.createDocumentFragment();

        occurrences.forEach(occurrence => {
            occurrencesById.set(String(occurrence.id), occurrence);
            fragment.appendChild(buildRow(occurrence));
        });

        tbody.appendChild(fragment);

        card.textContent = occurrences.length;
        countTarget.textContent = occurrences.length === 1
            ? "1 ocorrência lançada"
            : `${occurrences.length} ocorrências lançadas`;

        // Só agora, com a resposta em mãos, dá para afirmar que não há
        // ocorrência: tem alguma na lista, esconde o bloco; lista vazia, revela.
        emptyState.hidden = occurrences.length > 0;
    } catch (error) {
        // Falha de rede não é "nenhuma ocorrência lançada" — o bloco continua
        // oculto para não mentir sobre o estado do sistema.
        emptyState.hidden = true;
        card.textContent = "-";
        countTarget.textContent = "";

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

    // Delegação: as linhas são reescritas a cada carga, e ouvinte por botão
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

function init() {
    initOccurrenceModal();
    populateOccurrencesTable();
}

// Rodar tudo
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init(); // DOM já está pronto para rodar
}
