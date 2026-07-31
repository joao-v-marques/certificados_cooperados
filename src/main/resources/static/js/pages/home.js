/**
 * Início: termômetro da meta anual.
 *
 * Contrato com o HTML (data-*):
 *   [data-year-filter]    select de ano-base; trocar o valor recarrega o termômetro
 *   [data-goal-points]    meta de pontos do ano
 *   [data-goal-year]      ano-base, dentro da frase do termômetro
 *   [data-goal-reached]   cooperados ativos que bateram a meta
 *   [data-goal-total]     total de cooperados ativos
 *   [data-goal-percent]   percentual atingido, já com o "%"
 *   [data-goal-meter]     barra; é o progressbar que recebe os aria-value*
 *   [data-goal-fill]      preenchimento da barra
 *   [data-goal-deadline]  prazo restante do ano-base, na tarja do cabeçalho
 *   [data-goal-note]      leitura da barra em uma frase
 *
 * A tela lê o mesmo /annual-report do painel de controle de propósito: os
 * números do termômetro são os que o painel já agrega, e um endpoint separado
 * só criaria a chance de as duas telas discordarem sobre o mesmo ano.
 *
 * A meta não é escrita aqui — vem do relatório, que a lê do CoursePointsPolicy.
 *
 * O erro de carregamento sai em toast (ver utils/notyf.js).
 */

import {notifyError} from "../utils/notyf.js";

const API_URL = "/certificados-cooperados/api/v1/cooperative-members/annual-report";

/** Abaixo disso o ano-base entra na reta final e o prazo vira aviso. */
const DEADLINE_WARNING_DAYS = 60;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Último relatório recebido; a renderização toda lê daqui. */
let report = null;

/* =========================================================================
   Texto
   ========================================================================= */

function fill(selector, value) {
    document.querySelector(selector).textContent = value;
}

/**
 * Dias entre hoje e 31/12 do ano-base.
 *
 * A conta é feita em UTC porque só interessa a diferença de datas: com horário
 * local, o dia da virada do horário de verão tem 23 ou 25 horas e a divisão
 * erraria por um dia.
 */
function daysUntilEndOfYear(year) {
    const today = new Date();
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfYearUtc = Date.UTC(year, 11, 31);

    return Math.round((endOfYearUtc - todayUtc) / MS_PER_DAY);
}

/* =========================================================================
   Renderização
   ========================================================================= */

function renderDeadline(pending) {
    const deadline = document.querySelector("[data-goal-deadline]");
    const remainingDays = daysUntilEndOfYear(report.year);

    deadline.classList.remove("badge--warning", "badge--neutral");

    // Ano fechado não tem prazo a correr: o que a tela mostra é resultado, não
    // acompanhamento.
    if (remainingDays < 0) {
        deadline.textContent = "Ano-base encerrado";
        deadline.classList.add("badge--neutral");
        return;
    }

    if (remainingDays === 0) {
        deadline.textContent = "Último dia do ano-base";
    } else {
        deadline.textContent = `Faltam ${remainingDays} ${remainingDays === 1 ? "dia" : "dias"} para o fim do ano-base`;
    }

    // O aviso é sobre o que ainda dá para fazer: com todo mundo na meta, o
    // prazo curto não é problema nenhum.
    const isTight = remainingDays <= DEADLINE_WARNING_DAYS && pending > 0;
    deadline.classList.add(isTight ? "badge--warning" : "badge--neutral");
}

function renderNote(reached, pending, total) {
    const note = document.querySelector("[data-goal-note]");

    if (total === 0) {
        note.textContent = "Nenhum cooperado ativo cadastrado. Cadastre os cooperados para acompanhar a meta do ano.";
        return;
    }

    if (pending === 0) {
        note.textContent = `Todos os cooperados ativos fecharam a meta de ${report.year}.`;
        return;
    }

    if (reached === 0) {
        note.textContent = `Nenhum cooperado ativo fechou os ${report.annualGoalPoints} pontos de ${report.year} até agora.`;
        return;
    }

    note.textContent = `${pending} ${pending === 1 ? "cooperado ainda precisa" : "cooperados ainda precisam"} `
        + `somar ${report.annualGoalPoints} pontos até 31/12/${report.year}.`;
}

function renderGauge() {
    const total = report.totalMembers;
    const reached = report.membersWhoReachedGoal;
    const pending = total - reached;

    // Base sem cooperado ativo: a barra fica vazia em vez de dividir por zero.
    const percent = (total > 0) ? Math.round((reached / total) * 100) : 0;

    fill("[data-goal-points]", report.annualGoalPoints);
    fill("[data-goal-year]", report.year);
    fill("[data-goal-reached]", reached);
    fill("[data-goal-total]", total);
    fill("[data-goal-percent]", `${percent}%`);

    document.querySelector("[data-goal-fill]").style.width = `${percent}%`;

    // O leitor de tela recebe a contagem, não a porcentagem arredondada: é o
    // número que a tela está de fato afirmando.
    const meter = document.querySelector("[data-goal-meter]");
    meter.setAttribute("aria-valuenow", String(percent));
    meter.setAttribute("aria-valuetext", `${reached} de ${total} cooperados ativos, ${percent}%`);

    renderDeadline(pending);
    renderNote(reached, pending, total);
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

/**
 * Estado de falha: o que sobra na tela depois de um carregamento que não veio.
 *
 * Os números ficam em "-" e a barra vazia de propósito — a tela não pode
 * afirmar que ninguém atingiu a meta quando na verdade não sabe. O que muda são
 * os dois controles que ficariam com cara de quebrados: a tarja presa em
 * "Carregando..." e o select de ano sem nenhuma opção.
 */
function renderUnavailable() {
    const deadline = document.querySelector("[data-goal-deadline]");
    deadline.className = "badge badge--neutral";
    deadline.textContent = "Prazo indisponível";

    const select = document.querySelector("[data-year-filter]");
    if (select.options.length === 0) {
        const currentYear = new Date().getFullYear();

        const option = document.createElement("option");
        option.value = currentYear;
        option.textContent = currentYear;
        select.appendChild(option);
    }
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
        renderGauge();
    } catch (error) {
        // Os números continuam em "-" e a barra vazia: falha de rede não pode
        // virar "ninguém atingiu a meta" na tela.
        renderUnavailable();

        notifyError("Não foi possível carregar a meta do ano selecionado. Atualize a página.");
        console.error(error);
    } finally {
        select.disabled = false;
    }
}

/* =========================================================================
   Recusa vinda de outra tela

   Quem tenta abrir uma página sem ter o perfil cai aqui pelo redirecionamento
   do RestAccessDeniedHandler, que manda o motivo como código fixo na URL. O
   texto mora na tela, e não no servidor, pelo mesmo motivo do login: só código
   conhecido vira mensagem, então nada do que foi digitado na URL é exibido.
   ========================================================================= */

const DENIAL_MESSAGES = {
    "sem-acesso": "Você não tem permissão para acessar essa página.",
};

function notifyDenial() {
    const reason = new URLSearchParams(window.location.search).get("erro");
    const message = DENIAL_MESSAGES[reason];

    if (!message) return;

    notifyError(message);

    // O código sai da URL depois de virado toast: sem isso, recarregar a home
    // ou compartilhar o endereço repetiria um aviso que já foi lido.
    const url = new URL(window.location.href);
    url.searchParams.delete("erro");
    window.history.replaceState({}, "", url);
}

/* =========================================================================
   Ligação
   ========================================================================= */

function init() {
    notifyDenial();

    document.querySelector("[data-year-filter]")
        .addEventListener("change", event => loadReport(event.currentTarget.value));

    // Sem ano: o backend assume o corrente, que é o que a tela abre por padrão.
    loadReport(null);
}

// Rodar tudo
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init(); // DOM já está pronto para rodar
}
