/**
 * Dashboard de ocorrências: indicadores e três recortes do mesmo conjunto de
 * manifestações registradas.
 *
 * Contrato com o HTML (data-*):
 *   [data-period-filter]      select do recorte; "" é todo o período
 *   [data-dashboard]          bloco inteiro do painel, revelado quando há dado
 *   [data-empty-state]        vazio de base (nenhuma manifestação registrada)
 *   [data-kpi-*]              valores dos quatro indicadores
 *   [data-kpi-*-note]         a linha de apoio embaixo de cada indicador
 *   [data-chart-monthly]      área de desenho do gráfico de colunas
 *   [data-monthly-caption]    legenda embaixo do gráfico
 *   [data-monthly-table]      <tbody> da visão em tabela do gráfico
 *   [data-table-toggle]       botão que mostra e esconde essa tabela
 *   [data-rank-types] / [data-rank-members]   listas dos dois rankings
 *   [data-empty-types] / [data-empty-members] / [data-empty-monthly]
 *
 * De onde vêm os números
 * ----------------------
 * Tudo sai de GET /api/v1/occurrences, agregado aqui no navegador — não há
 * endpoint de resumo. É a mesma escolha da listagem (js/pages/occurrences.js):
 * no volume de uma secretaria executiva, uma consulta só e a conta local saem
 * mais baratas que somar no banco a cada troca de recorte. O custo é o corpo da
 * resposta, que traz as observações inteiras sem que o painel precise delas —
 * quando o histórico pesar, o caminho é um GET /api/v1/occurrences/summary
 * agregando no service, e só as funções de contagem daqui mudam.
 *
 * Sobre as cores: nenhuma vive neste arquivo. As marcas leem
 * var(--color-primary) e a régua var(--color-border), ambos de tokens.css.
 */

import {notifyError} from "../utils/notyf.js";

const OCCURRENCES_URL = "/certificados-cooperados/api/v1/occurrences";
const MEMBERS_URL = "/certificados-cooperados/api/v1/cooperative-members";

/** Quantas barras cada ranking mostra antes de juntar o resto em "Outros".
 *  Sete é o teto em que classes vizinhas ainda se distinguem; acima disso a
 *  leitura vira tabela, e é o que a cauda agrupada evita. */
const RANK_LIMIT = 7;

const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Tudo que a API devolveu. É a fonte de todos os recortes. */
let allOccurrences = [];

/** Total de cooperados cadastrados, só para dar denominador ao indicador de
 *  cooperados atendidos. Fica nulo se a consulta falhar — o indicador continua
 *  válido sem ele, então a falha não derruba o painel. */
let registeredMembers = null;

/* =========================================================================
   Formatação e datas

   A data-só (yyyy-MM-dd) nunca passa por Date: o construtor lê esse formato
   como UTC e, no fuso do Brasil, a manifestação do dia 1º cairia no mês
   anterior — o que deslocaria uma coluna inteira do gráfico. Ano e mês saem do
   próprio texto.
   ========================================================================= */

const yearOf = occurrence => String(occurrence.occurrenceDate ?? "").slice(0, 4);

const monthKeyOf = occurrence => String(occurrence.occurrenceDate ?? "").slice(0, 7);

const formatNumber = value => value.toLocaleString("pt-BR");

const formatDecimal = value => value.toLocaleString("pt-BR", {minimumFractionDigits: 1, maximumFractionDigits: 1});

const plural = (count, singular, pluralWord) => `${formatNumber(count)} ${count === 1 ? singular : pluralWord}`;

function formatMonthKey(monthKey) {
    const [year, month] = monthKey.split("-");
    return `${MONTH_NAMES[Number(month) - 1]} de ${year}`;
}

// Percentual inteiro: décimo de ponto em share de manifestação é precisão que o
// dado não tem e que ninguém usa para decidir nada.
const share = (part, total) => (total ? Math.round((part / total) * 100) : 0);

/* =========================================================================
   Agregação
   ========================================================================= */

// Conta ocorrências por chave e devolve pares [chave, total] do maior para o
// menor. Empate desempata pelo rótulo, em pt-BR, para a ordem não depender da
// ordem em que a API devolveu.
function countBy(occurrences, keyOf) {
    const counts = new Map();

    occurrences.forEach(occurrence => {
        const key = keyOf(occurrence);
        if (key === null || key === undefined || key === "") return;

        counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
}

/**
 * Corta a lista no teto de barras e junta a cauda em uma linha só.
 *
 * "Outros" não é uma categoria do cadastro: é a soma do que não coube. Por isso
 * vem com a contagem de classes que representa — sem isso a barra viraria uma
 * categoria fantasma, e ainda por cima grande. O substantivo é parâmetro porque
 * os dois rankings agrupam coisas diferentes: "Outros (4 tipos)" e
 * "Outros (9 cooperados)" não são a mesma frase.
 */
function withTail(pairs, [singular, pluralWord], limit = RANK_LIMIT) {
    if (pairs.length <= limit) return pairs.map(([label, value]) => ({label, value, tail: false}));

    const head = pairs.slice(0, limit).map(([label, value]) => ({label, value, tail: false}));
    const tail = pairs.slice(limit);
    const total = tail.reduce((sum, [, value]) => sum + value, 0);

    return [...head, {label: `Outros (${plural(tail.length, singular, pluralWord)})`, value: total, tail: true}];
}

/**
 * Os meses que o gráfico desenha, no recorte escolhido.
 *
 * Com um ano selecionado são os doze meses dele, sempre na mesma moldura — é o
 * que deixa dois anos comparáveis. Em "todo o período" seriam tantas colunas
 * quantos meses de histórico, então o eixo passa a ser os últimos doze meses
 * corridos, que é a janela que interessa a quem acompanha o dia a dia.
 */
function monthlySeries(occurrences, year) {
    const counts = new Map();
    occurrences.forEach(occurrence => {
        const key = monthKeyOf(occurrence);
        if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    const today = new Date();
    const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

    if (year) {
        return MONTH_LABELS.map((label, index) => {
            const key = `${year}-${String(index + 1).padStart(2, "0")}`;
            return {key, label, value: counts.get(key) ?? 0, current: key === currentKey};
        });
    }

    const months = [];

    for (let back = 11; back >= 0; back -= 1) {
        const date = new Date(today.getFullYear(), today.getMonth() - back, 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

        months.push({
            key,
            label: MONTH_LABELS[date.getMonth()],
            value: counts.get(key) ?? 0,
            current: key === currentKey,
        });
    }

    return months;
}

/** Quantos meses o recorte cobre, para a média mensal não dividir por doze um
 *  ano que ainda está no meio — o que faria o número parecer pior do que é. */
function elapsedMonths(occurrences, year) {
    const today = new Date();

    if (year) {
        return Number(year) === today.getFullYear() ? today.getMonth() + 1 : 12;
    }

    const keys = occurrences.map(monthKeyOf).filter(Boolean).sort();
    if (!keys.length) return 0;

    const [firstYear, firstMonth] = keys[0].split("-").map(Number);

    return (today.getFullYear() - firstYear) * 12 + (today.getMonth() + 1 - firstMonth) + 1;
}

/* =========================================================================
   Indicadores
   ========================================================================= */

function setKpi(name, value, note) {
    document.querySelector(`[data-kpi-${name}]`).textContent = value;

    const noteTarget = document.querySelector(`[data-kpi-${name}-note]`);
    // textContent: nome de tipo e de cooperado vêm do banco.
    noteTarget.textContent = note ?? "";
    noteTarget.classList.toggle("is-hidden", !note);
}

function renderKpis(scoped, year) {
    const total = scoped.length;

    // 1. O indicador obrigatório. Em "todo o período" é o número do sistema
    //    inteiro; com um ano escolhido, o do ano — e a nota diz qual dos dois,
    //    para o número nunca aparecer sem o recorte a que pertence.
    if (year) {
        const previousYear = Number(year) - 1;
        const previous = allOccurrences.filter(occurrence => Number(yearOf(occurrence)) === previousYear).length;

        if (previous) {
            const difference = total - previous;

            // O sinal é escrito à mão: o "+" não sai da formatação, e é ele que
            // diz que ali está uma variação, não um segundo total.
            setKpi("total", formatNumber(total),
                `${difference >= 0 ? "+" : "−"}${formatNumber(Math.abs(difference))} em relação a ${previousYear}`);
        } else {
            // Sem o ano anterior não há variação a mostrar — mas "primeiro ano
            // com registro" só vale se de fato não houver nada antes; com um
            // buraco no meio do histórico, a frase seria falsa.
            const earlier = allOccurrences.some(occurrence => Number(yearOf(occurrence)) < previousYear);

            setKpi("total", formatNumber(total),
                earlier ? `Nenhuma manifestação em ${previousYear}` : "Primeiro ano com registro");
        }
    } else {
        const months = elapsedMonths(scoped, "");
        setKpi("total", formatNumber(total), months ? `Em ${plural(months, "mês de histórico", "meses de histórico")}` : "");
    }

    // 2. Alcance: quantos cooperados diferentes estão por trás desse volume.
    const members = new Set(scoped.map(occurrence => occurrence.cooperativeMemberId)).size;

    setKpi("members", formatNumber(members), registeredMembers
        ? `de ${plural(registeredMembers, "cooperado cadastrado", "cooperados cadastrados")}`
        : "");

    // 3. Ritmo. Divide pelos meses corridos, e não pelos meses com lançamento:
    //    mês sem manifestação é informação, não ausência de dado.
    const months = elapsedMonths(scoped, year);

    setKpi("average", months ? formatDecimal(total / months) : "—",
        months ? `Em ${plural(months, "mês", "meses")} de calendário` : "");

    // 4. Concentração: diz se a demanda se espalha ou se mora quase toda em um
    //    assunto só — que é o que decide onde mexer primeiro.
    const types = countBy(scoped, occurrence => occurrence.occurrenceTypeName);

    if (types.length) {
        const [topName, topValue] = types[0];
        setKpi("top-type", `${share(topValue, total)}%`, topName);
    } else {
        setKpi("top-type", "—", "");
    }
}

/* =========================================================================
   Gráfico de colunas — manifestações por mês

   SVG desenhado em pixels reais, e não em viewBox esticada: com viewBox o texto
   escalaria junto com a largura do card e os rótulos ficariam minúsculos no
   celular e enormes no monitor. Por isso o desenho é refeito quando o card muda
   de tamanho (ResizeObserver, mais abaixo).
   ========================================================================= */

const SVG_NS = "http://www.w3.org/2000/svg";

const CHART = {
    height: 260,
    paddingTop: 16,
    paddingRight: 8,
    paddingBottom: 28,  // a faixa do eixo x entra na altura: sem isso o card ganharia um scroll interno só para os rótulos
    paddingLeft: 40,
    maxBarWidth: 24,    // barra fina; a sobra da faixa é ar, não preenchimento
    barRadius: 4,
    tickCount: 4,
};

function svgElement(name, attributes = {}) {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
    return element;
}

/**
 * Régua do eixo y em números redondos: 7 vira 0-2-4-6-8, 23 vira 0-10-20-30.
 * Régua em número quebrado obriga o leitor a fazer conta para estimar as
 * colunas do meio.
 *
 * O passo nunca é fracionário — são manifestações contadas, e um eixo marcando
 * 0,5 prometeria meia manifestação. E o teto é o primeiro múltiplo do passo
 * acima do maior valor, em vez de passo × número fixo de marcas: preso a
 * quatro marcas, um pico de 23 levaria o teto a 40 e achataria o gráfico
 * inteiro em pouco mais da metade da altura.
 */
function niceScale(maxValue, preferredTicks = CHART.tickCount) {
    const safe = Math.max(1, maxValue);
    const rough = safe / preferredTicks;
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const candidates = [1, 2, 5, 10].map(multiple => multiple * magnitude);
    const step = Math.max(1, candidates.find(candidate => candidate >= rough));
    const max = step * Math.ceil(safe / step);

    return {step, max, ticks: Math.round(max / step)};
}

// Retângulo com o topo arredondado e a base reta: a barra nasce da linha de
// base e é lá que ela precisa encostar sem sobrar canto.
function barPath(x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height));

    return `M${x} ${y + height} L${x} ${y + r} Q${x} ${y} ${x + r} ${y}`
        + ` L${x + width - r} ${y} Q${x + width} ${y} ${x + width} ${y + r}`
        + ` L${x + width} ${y + height} Z`;
}

function renderMonthlyChart(series) {
    const host = document.querySelector("[data-chart-monthly]");
    const width = host.clientWidth;

    // Sem largura ainda (card oculto, aba em segundo plano) não há o que
    // desenhar; o ResizeObserver chama de novo quando houver.
    if (!width) return;

    host.querySelector("svg")?.remove();

    const {height, paddingTop, paddingRight, paddingBottom, paddingLeft} = CHART;
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;
    const baseline = paddingTop + plotHeight;

    const scale = niceScale(Math.max(...series.map(month => month.value)));
    const bandWidth = plotWidth / series.length;
    const barWidth = Math.max(6, Math.min(CHART.maxBarWidth, bandWidth - 12));

    /*
     * Toda coluna com valor leva o número em cima.
     *
     * A primeira versão rotulava só o pico e o mês em curso — a regra clássica
     * de não pendurar número em todo ponto. Só que ela pressupõe gráfico denso:
     * aqui são doze colunas de dois ou três dígitos, e o efeito na tela foi o
     * contrário do pretendido — três meses com barra e sem número pareciam
     * defeito, porque não há como o leitor adivinhar por que aqueles dois
     * ganharam rótulo.
     *
     * O que continua valendo é não deixar rótulo espremido: se a faixa não
     * comportar o número mais largo, ninguém recebe rótulo e o valor fica com o
     * eixo, o hover e a tabela. Melhor nenhum do que texto colado no vizinho.
     */
    const widestLabel = formatNumber(scale.max).length * 7;
    const showValueLabels = bandWidth >= widestLabel + 4;

    // role="group", e não role="img": as faixas dos meses lá embaixo são
    // focáveis e têm rótulo próprio, e role="img" tornaria todo o conteúdo do
    // SVG presentacional — os doze meses sumiriam do leitor de tela justamente
    // por causa da etiqueta que deveria descrevê-los.
    const svg = svgElement("svg", {
        width, height, role: "group", "aria-label": "Manifestações por mês",
    });

    // Régua e rótulos do eixo y. Linha cheia e fina, um passo fora da
    // superfície: grade tracejada se lê como projeção ou limite, e aqui é só
    // grade.
    for (let tick = 0; tick <= scale.ticks; tick += 1) {
        const value = tick * scale.step;
        const y = baseline - (value / scale.max) * plotHeight;

        svg.appendChild(svgElement("line", {
            x1: paddingLeft, x2: width - paddingRight, y1: y, y2: y, class: "chart__grid",
        }));

        const label = svgElement("text", {
            x: paddingLeft - 8, y: y + 4, "text-anchor": "end", class: "chart__tick",
        });
        label.textContent = formatNumber(value);
        svg.appendChild(label);
    }

    series.forEach((month, index) => {
        const bandX = paddingLeft + index * bandWidth;
        const barX = bandX + (bandWidth - barWidth) / 2;
        const barHeight = (month.value / scale.max) * plotHeight;
        const barTop = baseline - barHeight;

        // Barra e alvo do ponteiro no mesmo grupo: é o que deixa o hover
        // escurecer a barra sem uma linha de JS (ver .chart__band no CSS).
        const band = svgElement("g", {class: "chart__band"});

        if (month.value > 0) {
            band.appendChild(svgElement("path", {
                d: barPath(barX, barTop, barWidth, barHeight, CHART.barRadius),
                // O mês em curso ainda não terminou: desenhado cheio, a coluna
                // menor pareceria queda, quando é só mês pela metade.
                class: month.current ? "chart__bar chart__bar--partial" : "chart__bar",
            }));
        }

        const tickLabel = svgElement("text", {
            x: bandX + bandWidth / 2, y: height - 10, "text-anchor": "middle", class: "chart__tick",
        });
        tickLabel.textContent = month.label;
        svg.appendChild(tickLabel);

        // Mês zerado não recebe rótulo: um "0" pendurado sobre a linha de base
        // não informa nada que a coluna ausente já não diga.
        if (month.value > 0 && showValueLabels) {
            const valueLabel = svgElement("text", {
                x: barX + barWidth / 2, y: barTop - 8,
                "text-anchor": "middle", class: "chart__value",
            });
            valueLabel.textContent = formatNumber(month.value);
            svg.appendChild(valueLabel);
        }

        // Alvo do ponteiro: a faixa inteira, não a barra. Mirar em coluna de
        // 24px (ou em coluna de altura zero) é exigência que ninguém cumpre.
        const hit = svgElement("rect", {
            x: bandX, y: paddingTop, width: bandWidth, height: plotHeight,
            class: "chart__hit", tabindex: "0", role: "img",
            "aria-label": `${formatMonthKey(month.key)}: ${plural(month.value, "manifestação", "manifestações")}`,
        });

        // O tooltip sobe a partir do topo da barra; com a coluna zerada, a
        // partir da linha de base.
        const show = () => showTooltip(host, bandX + bandWidth / 2, month.value > 0 ? barTop : baseline,
            formatMonthKey(month.key), plural(month.value, "manifestação", "manifestações"));

        hit.addEventListener("pointerenter", show);
        hit.addEventListener("focus", show);
        hit.addEventListener("pointerleave", () => hideTooltip(host));
        hit.addEventListener("blur", () => hideTooltip(host));

        band.appendChild(hit);
        svg.appendChild(band);
    });

    host.appendChild(svg);
}

/* Tooltip ---------------------------------------------------------------- */

function showTooltip(host, x, y, title, value) {
    const tooltip = host.querySelector("[data-tooltip]");

    // O valor lidera e o rótulo segue: quem já está com o ponteiro no mês quer
    // o número, não o nome do mês de novo.
    tooltip.querySelector("[data-tooltip-value]").textContent = value;
    tooltip.querySelector("[data-tooltip-label]").textContent = title;

    // Revelado antes de medir: escondido, offsetWidth é zero e o cálculo de
    // posição sairia todo errado no primeiro hover.
    tooltip.hidden = false;

    // Preso à área do gráfico nas duas direções, para não vazar do card na
    // primeira e na última coluna nem passar por cima do topo.
    const half = tooltip.offsetWidth / 2;

    tooltip.style.left = `${Math.min(Math.max(x, half), host.clientWidth - half)}px`;
    tooltip.style.top = `${Math.max(0, y - tooltip.offsetHeight - 8)}px`;
}

function hideTooltip(host) {
    host.querySelector("[data-tooltip]").hidden = true;
}

/* Visão em tabela -------------------------------------------------------- */

// A tabela é o par acessível do gráfico: mesmos números, sem depender de cor
// nem de ponteiro. É ela que garante que o tooltip só acrescente, nunca guarde.
function renderMonthlyTable(series) {
    const tbody = document.querySelector("[data-monthly-table]");
    tbody.innerHTML = "";

    const fragment = document.createDocumentFragment();

    series.forEach(month => {
        const row = document.createElement("tr");

        const label = document.createElement("th");
        label.setAttribute("scope", "row");
        label.textContent = formatMonthKey(month.key);

        const value = document.createElement("td");
        value.className = "table__num tabular";
        value.textContent = formatNumber(month.value);

        row.append(label, value);
        fragment.appendChild(row);
    });

    tbody.appendChild(fragment);
}

/* =========================================================================
   Rankings

   Barra em HTML, e não em SVG: são rótulos longos ("SOLICITAÇÃO DE
   COMPROVANTES PARA IR"), que o texto corrido quebra sozinho e o SVG só
   cortaria. Cada linha carrega rótulo e valor como texto de verdade, então a
   lista já é a própria tabela — não precisa de uma segunda visão para ser
   lida por leitor de tela.
   ========================================================================= */

function renderRanking(selector, items, total) {
    const list = document.querySelector(selector);
    list.innerHTML = "";

    // A escala é o maior do recorte, e não o total: com o total, uma cauda de
    // categorias pequenas viraria doze barras rentes ao chão, todas iguais.
    const highest = Math.max(...items.map(item => item.value), 1);

    const fragment = document.createDocumentFragment();

    items.forEach(item => {
        const row = document.createElement("li");
        row.className = item.tail ? "rank__row rank__row--tail" : "rank__row";
        row.title = `${item.label} — ${share(item.value, total)}% do período`;

        const label = document.createElement("p");
        label.className = "rank__label";
        // textContent: o nome vem do cadastro.
        label.textContent = item.label;

        const track = document.createElement("div");
        track.className = "rank__track";

        const fill = document.createElement("div");
        fill.className = "rank__fill";
        fill.style.width = `${(item.value / highest) * 100}%`;
        track.appendChild(fill);

        const value = document.createElement("p");
        value.className = "rank__value tabular";
        value.textContent = formatNumber(item.value);

        // A barra vai por último no DOM de propósito. A linha é uma grade de
        // duas colunas em que ela ocupa as duas, e o posicionamento automático
        // do grid não volta para trás: com a barra no meio, o valor cairia numa
        // terceira linha em vez de ficar ao lado do rótulo. Nessa ordem o leitor
        // de tela também ouve nome e número antes do enfeite.
        row.append(label, value, track);
        fragment.appendChild(row);
    });

    list.appendChild(fragment);
}

/* =========================================================================
   Recorte e desenho
   ========================================================================= */

function toggleEmpty(selector, isEmpty) {
    document.querySelector(selector).hidden = !isEmpty;
}

function render() {
    const year = document.querySelector("[data-period-filter]").value;

    const scoped = year
        ? allOccurrences.filter(occurrence => yearOf(occurrence) === year)
        : allOccurrences;

    renderKpis(scoped, year);

    const series = monthlySeries(scoped, year);
    const hasMonthlyData = series.some(month => month.value > 0);

    toggleEmpty("[data-empty-monthly]", !hasMonthlyData);
    document.querySelector("[data-chart-monthly]").hidden = !hasMonthlyData;

    // O vazio do gráfico precisa dizer de que janela está falando. Em "todo o
    // período" o eixo são os últimos doze meses: uma base inteira mais antiga
    // que isso deixaria o gráfico vazio ao lado de dois rankings cheios, e um
    // "nenhuma manifestação registrada" solto ali seria mentira.
    document.querySelector("[data-empty-monthly]").textContent = year
        ? `Nenhuma manifestação registrada em ${year}.`
        : "Nenhuma manifestação registrada nos últimos doze meses.";

    if (hasMonthlyData) renderMonthlyChart(series);
    renderMonthlyTable(series);

    // A nota do tom mais claro só aparece quando existe mesmo uma coluna
    // parcial desenhada — em ano fechado, ou com o mês corrente ainda zerado,
    // ela estaria explicando algo que não está na tela.
    document.querySelector("[data-partial-note]").hidden =
        !series.some(month => month.current && month.value > 0);

    document.querySelector("[data-monthly-caption]").textContent = year
        ? `Manifestações por mês em ${year}.`
        : "Manifestações por mês nos últimos doze meses.";

    const types = withTail(countBy(scoped, occurrence => occurrence.occurrenceTypeName), ["tipo", "tipos"]);
    const members = withTail(countBy(scoped, occurrence => occurrence.cooperativeMemberName), ["cooperado", "cooperados"]);

    toggleEmpty("[data-empty-types]", !types.length);
    toggleEmpty("[data-empty-members]", !members.length);

    renderRanking("[data-rank-types]", types, scoped.length);
    renderRanking("[data-rank-members]", members, scoped.length);
}

function fillPeriodFilter() {
    const select = document.querySelector("[data-period-filter]");
    const years = [...new Set(allOccurrences.map(yearOf).filter(Boolean))].sort().reverse();

    years.forEach(year => {
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        select.appendChild(option);
    });

    // Nasce em "todo o período": o indicador obrigatório é o número que o
    // sistema tem, e um ano escolhido por padrão o esconderia atrás de um
    // recorte que ninguém pediu.
    select.value = "";
}

/* =========================================================================
   Carga
   ========================================================================= */

async function loadOccurrences() {
    const response = await fetch(OCCURRENCES_URL, {credentials: "same-origin"});

    // Sessão expirada volta para o login em vez de virar "não foi possível
    // carregar".
    if (response.status === 401) {
        window.location.href = "login";
        return new Promise(() => {});
    }

    if (!response.ok) throw new Error(`A API respondeu ${response.status}`);

    const responseJSON = await response.json();

    return Array.isArray(responseJSON) ? responseJSON : [];
}

// Só para o denominador do indicador de cooperados atendidos. Falha aqui não
// pode derrubar o painel: o número de atendidos continua de pé sem o total.
async function loadRegisteredMembers() {
    try {
        const response = await fetch(MEMBERS_URL, {credentials: "same-origin"});
        if (!response.ok) return null;

        const responseJSON = await response.json();

        return Array.isArray(responseJSON) ? responseJSON.length : null;
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function load() {
    const dashboard = document.querySelector("[data-dashboard]");

    try {
        const [occurrences, members] = await Promise.all([loadOccurrences(), loadRegisteredMembers()]);

        allOccurrences = occurrences;
        registeredMembers = members;

        // Base sem nenhuma manifestação não é painel vazio de erro: é painel que
        // ainda não tem o que mostrar, e o texto do HTML já diz isso.
        if (!allOccurrences.length) {
            toggleEmpty("[data-empty-state]", true);
            return;
        }

        fillPeriodFilter();
        dashboard.hidden = false;
        render();
    } catch (error) {
        notifyError("Não foi possível carregar o painel de ocorrências. Atualize a página.");
        console.error(error);
    }
}

/* =========================================================================
   Ligação
   ========================================================================= */

function initTableToggle() {
    const toggle = document.querySelector("[data-table-toggle]");
    const table = document.querySelector("[data-monthly-table-wrap]");

    toggle.addEventListener("click", () => {
        const willOpen = table.hidden;

        table.hidden = !willOpen;
        toggle.setAttribute("aria-expanded", String(willOpen));
        toggle.textContent = willOpen ? "Ocultar dados" : "Ver dados";
    });
}

function initResize() {
    const host = document.querySelector("[data-chart-monthly]");

    // O gráfico é desenhado em pixels, então precisa ser refeito quando o card
    // muda de largura — abrir a sidebar já basta para mudar.
    let frame = null;

    new ResizeObserver(() => {
        if (host.hidden || !allOccurrences.length) return;

        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(() => {
            const year = document.querySelector("[data-period-filter]").value;
            renderMonthlyChart(monthlySeries(
                year ? allOccurrences.filter(occurrence => yearOf(occurrence) === year) : allOccurrences,
                year,
            ));
        });
    }).observe(host);
}

function init() {
    document.querySelector("[data-period-filter]").addEventListener("change", render);

    initTableToggle();
    initResize();
    load();
}

// Rodar tudo
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init(); // DOM já está pronto para rodar
}
