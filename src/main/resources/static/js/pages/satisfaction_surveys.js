/**
 * Página do índice de satisfação: lista, cadastra, edita e exclui as pesquisas
 * anuais de satisfação dos cooperados.
 *
 * Endpoints (todos sob o context-path da aplicação):
 *   GET    /api/v1/satisfaction-surveys?order=desc  histórico, do ano mais recente
 *   POST   /api/v1/satisfaction-surveys   {surveyYear, totalMembers, respondents, satisfactionIndex}
 *   PUT    /api/v1/satisfaction-surveys/{id}  mesmo corpo do POST → 200 + a pesquisa atualizada
 *   DELETE /api/v1/satisfaction-surveys/{id}  → 204 SEM CORPO
 *
 * O DELETE apaga de verdade: satisfaction_surveys não tem is_active e nenhuma
 * outra tabela a referencia. Por isso a confirmação avisa que não há como
 * desfazer, e por isso a resposta é 204 — não sobra registro para devolver.
 *
 * A tela pede a listagem uma vez só, em ordem decrescente, e inverte o array
 * para o gráfico: são os mesmos dados em outra ordem, e um segundo GET só para
 * isso seria uma ida ao servidor para reordenar o que já está na memória.
 *
 * `notReached` e `responseRate` chegam prontos da API — são calculados no
 * service a partir do total e dos respondentes, e não existem como coluna. A
 * conta é repetida aqui em um lugar só: a prévia do formulário, que mostra o
 * que vai ser gravado antes de salvar.
 *
 * Contrato com o HTML (data-*):
 *   [data-responsibility-modal]   aviso de responsabilidade, aberto na carga
 *   [data-responsibility-accept]  botão "Eu concordo", única saída do aviso
 *   [data-kpi-*]               os quatro indicadores do topo
 *   [data-chart-card]          card do gráfico, revelado a partir de 2 pesquisas
 *   [data-chart]               área de desenho do SVG
 *   [data-survey-form]         formulário de cadastro, submit interceptado
 *   [data-preview-*]           prévia dos derivados, recalculada ao digitar
 *   [data-surveys-table]       <tbody> da tabela
 *   [data-empty-state]         bloco de "nenhuma pesquisa lançada"
 *   [data-table-count]         rodapé com a contagem
 *   [data-survey-edit-modal]   <dialog> da edição
 *   [data-survey-edit-form]    formulário dentro do modal de edição
 *   [data-edit-error]          recusa da edição que não é de campo
 *   [data-survey-delete-modal] <dialog> da confirmação de exclusão
 *   [data-delete-summary]      ano e números da pesquisa em destaque
 *   [data-delete-confirm]      botão que confirma
 *   [data-delete-error]        recusa da exclusão
 *   [data-modal-close]         qualquer botão que fecha o modal em que está
 *
 * Nas linhas da tabela:
 *   [data-edit-survey="<id>"]    abre a edição
 *   [data-delete-survey="<id>"]  abre a confirmação de exclusão
 *
 * O retorno de sucesso e de erro sai em toast (ver utils/notyf.js); o que é
 * específico de um campo continua no <p class="field__error"> dele. Com um
 * <dialog> aberto o toast fica atrás dele, então a recusa dentro de um modal
 * aparece no rodapé do próprio modal.
 */

import {dismissNotifications, notifyError, notifySuccess} from "../utils/notyf.js";

const API_URL = "/certificados-cooperados/api/v1/satisfaction-surveys";

// Liga o campo que o backend devolve em `fields` aos elementos da tela. Cada
// formulário tem o seu mapa porque o cadastro e a edição usam os mesmos nomes
// de campo em inputs diferentes.
const FORM_FIELDS = {
    surveyYear: {inputId: "pesquisa-ano", errorId: "erro-pesquisa-ano"},
    totalMembers: {inputId: "pesquisa-total", errorId: "erro-pesquisa-total"},
    respondents: {inputId: "pesquisa-respondentes", errorId: "erro-pesquisa-respondentes"},
    satisfactionIndex: {inputId: "pesquisa-indice", errorId: "erro-pesquisa-indice"},
};

const EDIT_FIELDS = {
    surveyYear: {inputId: "edicao-pesquisa-ano", errorId: "erro-edicao-pesquisa-ano"},
    totalMembers: {inputId: "edicao-pesquisa-total", errorId: "erro-edicao-pesquisa-total"},
    respondents: {inputId: "edicao-pesquisa-respondentes", errorId: "erro-edicao-pesquisa-respondentes"},
    satisfactionIndex: {inputId: "edicao-pesquisa-indice", errorId: "erro-edicao-pesquisa-indice"},
};

/**
 * Último resultado do GET, guardado por id.
 *
 * Os modais são preenchidos a partir daqui, e não de uma nova chamada: a
 * listagem já traz tudo que os dois mostram.
 */
const surveysById = new Map();

/** Última listagem recebida, em ordem decrescente. O gráfico a percorre invertida. */
let currentSurveys = [];

/* =========================================================================
   Formatação
   ========================================================================= */

const integerFormatter = new Intl.NumberFormat("pt-BR");
const decimalFormatter = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

function formatInteger(value) {
    return integerFormatter.format(Number(value ?? 0));
}

/** O índice e a taxa vêm como número decimal; a tela sempre mostra as duas casas. */
function formatPercent(value) {
    return `${decimalFormatter.format(Number(value ?? 0))}%`;
}

/**
 * O nome de quem lançou é digitado no cadastro de usuário e volta da API, então
 * não pode ser interpolado cru na linha da tabela.
 *
 * Vale também para o toast: o Notyf grava a mensagem com innerHTML
 * (vendor/notyf/notyf.es.js).
 */
function escapeHtml(value) {
    const characters = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"};
    return String(value ?? "").replace(/[&<>"']/g, character => characters[character]);
}

function plural(count, singular, pluralWord) {
    return `${formatInteger(count)} ${count === 1 ? singular : pluralWord}`;
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
   Leitura dos campos

   Os quatro campos são numéricos. `null` quer dizer vazio ou inválido, e é o
   que separa "não informado" de "informado como zero" — zero é valor legítimo
   em respondentes e no índice.
   ========================================================================= */

function numberValue(inputId) {
    const raw = document.getElementById(inputId).value.trim();
    if (raw === "") return null;

    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
}

function readForm(fieldMap) {
    return {
        surveyYear: numberValue(fieldMap.surveyYear.inputId),
        totalMembers: numberValue(fieldMap.totalMembers.inputId),
        respondents: numberValue(fieldMap.respondents.inputId),
        satisfactionIndex: numberValue(fieldMap.satisfactionIndex.inputId),
    };
}

/**
 * Recusa o que a tela já sabe estar errado, para não gastar uma ida ao servidor
 * ouvindo de volta o óbvio. O resto da validação continua sendo do backend, que
 * é quem conhece o ano já lançado e a faixa permitida.
 */
function localErrors(values) {
    const errors = {};

    if (values.surveyYear === null) errors.surveyYear = "Informe o ano da pesquisa.";
    if (values.totalMembers === null) errors.totalMembers = "Informe o total de cooperados.";
    if (values.respondents === null) errors.respondents = "Informe quantos cooperados responderam.";
    if (values.satisfactionIndex === null) errors.satisfactionIndex = "Informe o índice de satisfação.";

    if (values.totalMembers !== null && values.respondents !== null
        && values.respondents > values.totalMembers) {
        errors.respondents = "Não pode ser maior que o total de cooperados.";
    }

    return errors;
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

    // O DELETE responde 204 sem corpo: ler como JSON estouraria com a exclusão
    // já feita. Vale também para uma resposta de erro que não venha em JSON.
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
   Indicadores

   Todos descrevem a pesquisa mais recente, que é a primeira da lista (o GET
   vem em ordem decrescente).
   ========================================================================= */

function clearSummary() {
    ["year", "index", "rate", "not-reached"].forEach(key => {
        document.querySelector(`[data-kpi-${key}]`).textContent = "-";
    });

    ["year-note", "index-delta", "rate-note", "not-reached-note"].forEach(key => {
        const element = document.querySelector(`[data-kpi-${key}]`);
        element.textContent = "";
        element.classList.remove("stat__delta--good", "stat__delta--bad");
    });
}

function updateSummary(surveys) {
    if (!surveys.length) {
        clearSummary();
        return;
    }

    const [latest, previous] = surveys;

    document.querySelector("[data-kpi-year]").textContent = latest.surveyYear;
    document.querySelector("[data-kpi-year-note]").textContent =
        plural(surveys.length, "pesquisa no histórico", "pesquisas no histórico");

    document.querySelector("[data-kpi-index]").textContent = formatPercent(latest.satisfactionIndex);

    const deltaElement = document.querySelector("[data-kpi-index-delta]");
    deltaElement.classList.remove("stat__delta--good", "stat__delta--bad");

    if (previous) {
        // Variação em pontos percentuais, e não em "%": a diferença entre 80% e
        // 84% é de 4 p.p.; chamar isso de "4%" seria outra conta (5% de aumento).
        const difference = Number(latest.satisfactionIndex) - Number(previous.satisfactionIndex);
        const sign = difference > 0 ? "+" : "";

        // innerHTML aqui é seguro: só entram números formatados por esta função.
        deltaElement.innerHTML =
            `<strong>${sign}${decimalFormatter.format(difference)} p.p.</strong> em relação a ${previous.surveyYear}`;

        if (difference > 0) deltaElement.classList.add("stat__delta--good");
        if (difference < 0) deltaElement.classList.add("stat__delta--bad");
    } else {
        deltaElement.textContent = "Primeira pesquisa lançada.";
    }

    document.querySelector("[data-kpi-rate]").textContent = formatPercent(latest.responseRate);
    document.querySelector("[data-kpi-rate-note]").textContent =
        `${formatInteger(latest.respondents)} de ${formatInteger(latest.totalMembers)} cooperados responderam.`;

    document.querySelector("[data-kpi-not-reached]").textContent = formatInteger(latest.notReached);
    document.querySelector("[data-kpi-not-reached-note]").textContent =
        `Não responderam à pesquisa de ${latest.surveyYear}.`;
}

/* =========================================================================
   Gráfico da evolução

   SVG desenhado em pixels reais, e não em viewBox esticada: com viewBox o texto
   escalaria junto com a largura do card e os rótulos ficariam minúsculos no
   celular e enormes no monitor. Por isso o desenho é refeito quando o card muda
   de tamanho (ResizeObserver, mais abaixo).
   ========================================================================= */

const SVG_NS = "http://www.w3.org/2000/svg";

const CHART = {
    height: 260,
    paddingTop: 24,     // sobra para o rótulo em cima da coluna mais alta
    paddingRight: 8,
    paddingBottom: 28,  // a faixa do eixo x entra na altura: sem isso o card ganharia um scroll interno só para os rótulos
    paddingLeft: 44,    // cabe "100%" alinhado à direita da régua
    maxBarWidth: 56,
    barRadius: 4,
};

/**
 * A régua vai de 0 a 100 sempre, e não do menor ao maior valor da série.
 *
 * Escala automática aqui mentiria: três anos com 86%, 87% e 88% virariam um
 * degrau dramático se o eixo começasse em 85. O índice é percentual e a
 * comparação honesta é contra o total.
 */
const SCALE_MAX = 100;
const SCALE_TICKS = [0, 25, 50, 75, 100];

function svgElement(name, attributes = {}) {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
    return element;
}

// Retângulo com o topo arredondado e a base reta: a barra nasce da linha de
// base e é lá que ela precisa encostar sem sobrar canto.
function barPath(x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height));

    return `M${x} ${y + height} L${x} ${y + r} Q${x} ${y} ${x + r} ${y}`
        + ` L${x + width - r} ${y} Q${x + width} ${y} ${x + width} ${y + r}`
        + ` L${x + width} ${y + height} Z`;
}

/** Recebe a série em ordem crescente de ano. */
function renderChart(series) {
    const host = document.querySelector("[data-chart]");
    if (!host) return;

    const width = host.clientWidth;

    // Sem largura ainda (card oculto, aba em segundo plano) não há o que
    // desenhar; o ResizeObserver chama de novo quando houver.
    if (!width || !series.length) return;

    host.querySelector("svg")?.remove();

    const {height, paddingTop, paddingRight, paddingBottom, paddingLeft} = CHART;
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;
    const baseline = paddingTop + plotHeight;

    const bandWidth = plotWidth / series.length;
    const barWidth = Math.max(8, Math.min(CHART.maxBarWidth, bandWidth - 16));

    // Rótulo espremido é pior que rótulo nenhum: sem espaço, o valor fica com o
    // eixo e com a tabela logo abaixo.
    const showValueLabels = bandWidth >= 56;

    const svg = svgElement("svg", {
        width, height, role: "img",
        "aria-label": "Índice de satisfação apurado em cada ano. Os valores exatos estão na tabela abaixo.",
    });

    // Régua e rótulos do eixo y.
    SCALE_TICKS.forEach(value => {
        const y = baseline - (value / SCALE_MAX) * plotHeight;

        svg.appendChild(svgElement("line", {
            x1: paddingLeft, x2: width - paddingRight, y1: y, y2: y, class: "chart__grid",
        }));

        const label = svgElement("text", {
            x: paddingLeft - 8, y: y + 4, "text-anchor": "end", class: "chart__tick",
        });
        label.textContent = `${value}%`;
        svg.appendChild(label);
    });

    const lastIndex = series.length - 1;

    series.forEach((survey, index) => {
        const bandX = paddingLeft + index * bandWidth;
        const barX = bandX + (bandWidth - barWidth) / 2;
        const barHeight = (Number(survey.satisfactionIndex) / SCALE_MAX) * plotHeight;
        const barTop = baseline - barHeight;

        // Barra e rótulos no mesmo grupo: é o que deixa o hover escurecer a
        // barra sem uma linha de JS (ver .chart__band no CSS).
        const band = svgElement("g", {class: "chart__band"});

        if (barHeight > 0) {
            band.appendChild(svgElement("path", {
                d: barPath(barX, barTop, barWidth, barHeight, CHART.barRadius),
                // O ano mais recente é o descrito pelos indicadores do topo.
                class: index === lastIndex ? "chart__bar chart__bar--latest" : "chart__bar",
            }));
        }

        const yearLabel = svgElement("text", {
            x: bandX + bandWidth / 2, y: height - 10, "text-anchor": "middle", class: "chart__tick",
        });
        yearLabel.textContent = survey.surveyYear;
        band.appendChild(yearLabel);

        if (showValueLabels) {
            const valueLabel = svgElement("text", {
                x: bandX + bandWidth / 2, y: Math.max(barTop - 8, paddingTop - 8),
                "text-anchor": "middle", class: "chart__value",
            });
            valueLabel.textContent = formatPercent(survey.satisfactionIndex);
            band.appendChild(valueLabel);
        }

        svg.appendChild(band);
    });

    host.appendChild(svg);
}

/**
 * O gráfico só aparece a partir da segunda pesquisa: com um ano só não há
 * evolução para mostrar, e uma coluna sozinha passa a impressão de gráfico
 * quebrado.
 */
function updateChart(surveys) {
    const card = document.querySelector("[data-chart-card]");
    if (!card) return;

    const hasEvolution = surveys.length >= 2;
    card.hidden = !hasEvolution;

    if (!hasEvolution) {
        document.querySelector("[data-chart]")?.querySelector("svg")?.remove();
        return;
    }

    // A listagem chega decrescente; o gráfico lê o tempo da esquerda para a direita.
    renderChart([...surveys].reverse());
}

function initChartResize() {
    const host = document.querySelector("[data-chart]");
    if (!host || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
        if (currentSurveys.length >= 2) renderChart([...currentSurveys].reverse());
    });

    observer.observe(host);
}

/* =========================================================================
   Listagem
   ========================================================================= */

/** Desenha uma linha da tabela a partir de uma pesquisa da listagem. */
function buildRow(survey) {
    const row = document.createElement("tr");

    // O nome de quem lançou é do cadastro de usuário e pode estar vazio (a
    // coluna users.name é opcional na V1).
    const insertedBy = survey.insertedByName
        ? `<span class="table__secondary">Lançado por ${escapeHtml(survey.insertedByName)}</span>`
        : "";

    row.innerHTML = `
        <td data-label="Ano">
            <span class="table__primary tabular">${survey.surveyYear}</span>
            ${insertedBy}
        </td>
        <td class="table__num" data-label="Cooperados">${formatInteger(survey.totalMembers)}</td>
        <td class="table__num" data-label="Responderam">${formatInteger(survey.respondents)}</td>
        <td class="table__num" data-label="Não atingidos">${formatInteger(survey.notReached)}</td>
        <td class="table__num" data-label="Taxa de resposta">${formatPercent(survey.responseRate)}</td>
        <td class="table__num" data-label="Índice">
            <span class="table__primary tabular">${formatPercent(survey.satisfactionIndex)}</span>
        </td>
        <td class="table__actions">
            <button type="button" class="btn-icon surveys-table__action"
                    data-edit-survey="${survey.id}" title="Editar pesquisa">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M9.5 3 13 6.5 5.5 14H2v-3.5L9.5 3Z" stroke="currentColor"
                          stroke-width="1.4" stroke-linejoin="round"/>
                </svg>
                <span class="visually-hidden">Editar a pesquisa de ${survey.surveyYear}</span>
            </button>
            <button type="button" class="btn-icon surveys-table__action surveys-table__action--danger"
                    data-delete-survey="${survey.id}" title="Excluir pesquisa">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.5 8.5h6l.5-8.5"
                          stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
                </svg>
                <span class="visually-hidden">Excluir a pesquisa de ${survey.surveyYear}</span>
            </button>
        </td>
    `;

    return row;
}

async function populateSurveysTable() {
    const tbody = document.querySelector("[data-surveys-table]");
    const emptyState = document.querySelector("[data-empty-state]");
    const tableCount = document.querySelector("[data-table-count]");

    tbody.innerHTML = "";
    surveysById.clear();

    const fragment = document.createDocumentFragment();

    try {
        const result = await apiRequest(`${API_URL}?order=desc`);
        if (!result) return;

        if (!result.ok) {
            throw new Error(`A API respondeu ${result.status}`);
        }

        // A API devolve um array puro, já ordenado por ano decrescente; a guarda
        // evita quebrar caso isso mude.
        const surveys = Array.isArray(result.body) ? result.body : [];
        currentSurveys = surveys;

        surveys.forEach(survey => {
            surveysById.set(String(survey.id), survey);
            fragment.appendChild(buildRow(survey));
        });

        tbody.appendChild(fragment);
        updateSummary(surveys);
        updateChart(surveys);

        tableCount.textContent = surveys.length === 1
            ? "1 pesquisa lançada"
            : `${surveys.length} pesquisas lançadas`;

        // Só agora, com a resposta em mãos, dá para afirmar que não há pesquisa
        // nenhuma: tem alguém na lista, esconde o bloco; lista vazia, revela.
        emptyState.hidden = surveys.length > 0;
    } catch (error) {
        // Falha de rede não é "nenhuma pesquisa lançada" — o bloco continua
        // oculto para não mentir sobre o estado do cadastro.
        emptyState.hidden = true;
        tableCount.textContent = "";
        currentSurveys = [];
        clearSummary();
        updateChart([]);

        notifyError("Não foi possível carregar as pesquisas de satisfação. Atualize a página.");
        console.error(error);
    }
}

/* =========================================================================
   Modais

   Abertura e fechamento são do <dialog> nativo: showModal() já prende o foco
   dentro do painel, torna o resto da página inerte e faz o Esc fechar.
   ========================================================================= */

function initModalClosers() {
    document.querySelectorAll("[data-modal-close]").forEach(button => {
        button.addEventListener("click", () => button.closest("dialog")?.close());
    });
}

/* =========================================================================
   Prévia dos derivados

   Mostra, antes de salvar, o que o backend vai calcular. A conta é a mesma do
   toResponse do service; o valor exibido depois de salvar continua vindo da
   API, e não daqui.
   ========================================================================= */

function updatePreview() {
    const notReachedElement = document.querySelector("[data-preview-not-reached]");
    const rateElement = document.querySelector("[data-preview-rate]");
    if (!notReachedElement || !rateElement) return;

    const total = numberValue("pesquisa-total");
    const respondents = numberValue("pesquisa-respondentes");

    // Sem os dois números, ou com uma combinação impossível, não há prévia
    // honesta a mostrar — inventar um negativo seria pior que o traço.
    if (total === null || respondents === null || total <= 0 || respondents > total) {
        notReachedElement.textContent = "-";
        rateElement.textContent = "-";
        return;
    }

    notReachedElement.textContent = formatInteger(total - respondents);
    rateElement.textContent = formatPercent((respondents * 100) / total);
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

    const values = readForm(FORM_FIELDS);
    const errors = localErrors(values);

    if (Object.keys(errors).length) {
        showFieldErrors(FORM_FIELDS, errors)?.focus();
        return;
    }

    submitButton.disabled = true;

    try {
        const result = await apiRequest(API_URL, {method: "POST", body: values});
        if (!result) return;

        if (!result.ok) {
            // Ano repetido e ano fora da faixa chegam como regra de negócio (400
            // com `fields` vazio), então o toast é o único lugar em que aparecem.
            notifyError(messageOf(result, "Não foi possível cadastrar a pesquisa. Tente de novo."));
            showFieldErrors(FORM_FIELDS, fieldsOf(result))?.focus();
            return;
        }

        // Limpar antes de avisar: reset() dispara o evento de reset, que derruba
        // os toasts — na ordem inversa o sucesso apareceria e sumiria na hora.
        form.reset();
        updatePreview();
        notifySuccess(`Pesquisa de ${result.body?.surveyYear ?? values.surveyYear} lançada com sucesso.`);

        // A lista só é recarregada depois do 201, para não mostrar uma pesquisa
        // que o backend recusou.
        await populateSurveysTable();
    } catch (error) {
        notifyError("Não foi possível conectar ao servidor. Tente de novo.");
        console.error(error);
    } finally {
        submitButton.disabled = false;
    }
}

function initSurveyForm() {
    const form = document.querySelector("[data-survey-form]");
    if (!form) return;

    form.addEventListener("submit", handleSubmit);

    // "Limpar campos" também zera o que sobrou do envio anterior.
    form.addEventListener("reset", () => {
        dismissNotifications();
        clearFieldErrors(FORM_FIELDS);
        // O reset ainda não chegou aos inputs quando este evento dispara.
        window.setTimeout(updatePreview, 0);
    });

    ["pesquisa-total", "pesquisa-respondentes"].forEach(inputId => {
        document.getElementById(inputId)?.addEventListener("input", updatePreview);
    });
}

/**
 * O ano futuro é recusado pelo BaseYearPolicy no backend. Travar o campo aqui
 * evita a viagem e deixa a regra visível no próprio controle — no HTML o teto
 * não pode ser fixo, porque ele muda na virada do ano.
 */
function initYearLimits() {
    const currentYear = String(new Date().getFullYear());

    ["pesquisa-ano", "edicao-pesquisa-ano"].forEach(inputId => {
        document.getElementById(inputId)?.setAttribute("max", currentYear);
    });
}

/* =========================================================================
   Edição (PUT)
   ========================================================================= */

function openEditModal(survey) {
    const modal = document.querySelector("[data-survey-edit-modal]");
    const yearInput = document.getElementById("edicao-pesquisa-ano");

    clearFieldErrors(EDIT_FIELDS);
    clearModalError(document.querySelector("[data-edit-error]"));

    // Guardado no formulário para o submit saber qual pesquisa está sendo
    // editada sem depender de qual linha foi clicada por último.
    document.querySelector("[data-survey-edit-form]").dataset.surveyId = String(survey.id);

    yearInput.value = survey.surveyYear;
    document.getElementById("edicao-pesquisa-total").value = survey.totalMembers;
    document.getElementById("edicao-pesquisa-respondentes").value = survey.respondents;
    document.getElementById("edicao-pesquisa-indice").value = survey.satisfactionIndex;

    modal.showModal();
    yearInput.focus();
    yearInput.select();
}

async function handleEditSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');
    const errorElement = document.querySelector("[data-edit-error]");
    const modal = document.querySelector("[data-survey-edit-modal]");
    const id = form.dataset.surveyId;

    clearFieldErrors(EDIT_FIELDS);
    clearModalError(errorElement);

    const values = readForm(EDIT_FIELDS);
    const errors = localErrors(values);

    if (Object.keys(errors).length) {
        showFieldErrors(EDIT_FIELDS, errors)?.focus();
        return;
    }

    submitButton.disabled = true;

    try {
        const result = await apiRequest(`${API_URL}/${id}`, {method: "PUT", body: values});
        if (!result) return;

        if (!result.ok) {
            // Com o modal aberto o toast fica atrás dele, então a recusa vai
            // para o rodapé do painel — inclusive a de ano já lançado.
            showModalError(errorElement, messageOf(result, "Não foi possível salvar a edição. Tente de novo."));
            showFieldErrors(EDIT_FIELDS, fieldsOf(result))?.focus();
            return;
        }

        // Fechar antes de avisar: com o <dialog> na top layer, o toast desenhado
        // embaixo dele passaria despercebido.
        modal.close();
        notifySuccess(`Pesquisa de ${result.body?.surveyYear ?? values.surveyYear} atualizada.`);

        await populateSurveysTable();
    } catch (error) {
        showModalError(errorElement, "Não foi possível conectar ao servidor. Tente de novo.");
        console.error(error);
    } finally {
        submitButton.disabled = false;
    }
}

function initEditModal() {
    const form = document.querySelector("[data-survey-edit-form]");
    if (!form) return;

    form.addEventListener("submit", handleEditSubmit);
}

/* =========================================================================
   Exclusão (DELETE)

   Apaga de verdade, e o backend responde 204 sem corpo. A confirmação repete
   os números da linha para o clique não depender da memória de qual botão foi
   apertado.
   ========================================================================= */

function openDeleteModal(survey) {
    const modal = document.querySelector("[data-survey-delete-modal]");
    const confirmButton = document.querySelector("[data-delete-confirm]");

    clearModalError(document.querySelector("[data-delete-error]"));

    // textContent, e não innerHTML: são números, mas o bloco não tem motivo
    // nenhum para interpretar marcação.
    document.querySelector("[data-delete-summary]").textContent =
        `Pesquisa de ${survey.surveyYear} — ${formatPercent(survey.satisfactionIndex)} de satisfação, `
        + `com ${formatInteger(survey.respondents)} de ${formatInteger(survey.totalMembers)} cooperados respondendo.`;

    confirmButton.dataset.surveyId = String(survey.id);

    modal.showModal();
    confirmButton.focus();
}

async function handleDeleteConfirm(event) {
    const confirmButton = event.currentTarget;
    const errorElement = document.querySelector("[data-delete-error]");
    const modal = document.querySelector("[data-survey-delete-modal]");

    const id = confirmButton.dataset.surveyId;
    const survey = surveysById.get(id);
    if (!survey) return;

    clearModalError(errorElement);
    confirmButton.disabled = true;

    try {
        const result = await apiRequest(`${API_URL}/${id}`, {method: "DELETE"});
        if (!result) return;

        if (!result.ok) {
            showModalError(errorElement, messageOf(result, "Não foi possível excluir a pesquisa. Tente de novo."));
            return;
        }

        modal.close();
        notifySuccess(`Pesquisa de ${survey.surveyYear} excluída.`);

        await populateSurveysTable();
    } catch (error) {
        showModalError(errorElement, "Não foi possível conectar ao servidor. Tente de novo.");
        console.error(error);
    } finally {
        confirmButton.disabled = false;
    }
}

function initDeleteModal() {
    const confirmButton = document.querySelector("[data-delete-confirm]");
    if (!confirmButton) return;

    confirmButton.addEventListener("click", handleDeleteConfirm);
}

/* =========================================================================
   Ações da linha

   Um listener só no <tbody>, e não um por botão: as linhas são redesenhadas a
   cada recarga da tabela, e ligar botão a botão exigiria refazer tudo junto.
   ========================================================================= */

function initRowActions() {
    const tbody = document.querySelector("[data-surveys-table]");
    if (!tbody) return;

    tbody.addEventListener("click", event => {
        const editButton = event.target.closest("[data-edit-survey]");
        if (editButton) {
            const survey = surveysById.get(editButton.dataset.editSurvey);
            if (survey) openEditModal(survey);
            return;
        }

        const deleteButton = event.target.closest("[data-delete-survey]");
        if (deleteButton) {
            const survey = surveysById.get(deleteButton.dataset.deleteSurvey);
            if (survey) openDeleteModal(survey);
        }
    });
}

/* =========================================================================
   Aviso de responsabilidade
   ========================================================================= */

/**
 * Abre o aviso a cada carga da página. O aceite não é guardado de propósito:
 * ele vale para o lançamento que está sendo feito agora, não para o
 * colaborador.
 *
 * O <dialog> nativo já escurece o fundo, prende o foco e torna o resto da tela
 * inerte. Falta só fechar as duas saídas que ele oferece de graça: o Esc, aqui
 * cancelado, e o botão de fechar do cabeçalho, que este modal não tem. Clique
 * no fundo não fecha <dialog> sem JS, então não há o que barrar.
 */
function initResponsibilityNotice() {
    const modal = document.querySelector("[data-responsibility-modal]");
    if (!modal) return;

    modal.addEventListener("cancel", event => event.preventDefault());

    modal.querySelector("[data-responsibility-accept]")
        .addEventListener("click", () => modal.close());

    modal.showModal();
}

/* =========================================================================
   Ligação
   ========================================================================= */

function init() {
    initResponsibilityNotice();
    initSurveyForm();
    initYearLimits();
    initModalClosers();
    initEditModal();
    initDeleteModal();
    initRowActions();
    initChartResize();
    populateSurveysTable();
}

// Rodar tudo
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init(); // DOM já está pronto para rodar
}
