/**
 * Dashboard de ocorrências: indicadores e recortes do mesmo conjunto de
 * manifestações registradas, de cooperados e da rede credenciada.
 *
 * Contrato com o HTML (data-*):
 *   [data-period-filter]          select do ano; "" é todo o período
 *   [data-relation-filter]        radios name="relation" ("" | cooperado | rede)
 *   [data-dashboard]              bloco inteiro do painel, revelado quando há dado
 *   [data-empty-state]            vazio de base (nenhuma manifestação registrada)
 *   [data-kpi-*]                  valores dos quatro indicadores
 *   [data-kpi-*-note]             a linha de apoio embaixo de cada indicador
 *   [data-chart-monthly]          área de desenho do gráfico de colunas
 *   [data-chart-legend]           legenda, com [data-legend="<lado>"] por série
 *   [data-monthly-caption]        legenda embaixo do título do gráfico
 *   [data-monthly-table]          <tbody> da visão em tabela do gráfico
 *   [data-table-toggle]           botão que mostra e esconde essa tabela
 *   [data-relation-*]             painel cooperado × rede (bar, caption, share,
 *                                 count, reach e side, por lado)
 *   [data-rank-card="<lado>"]     card de ranking de solicitantes de um lado
 *   [data-rank-types] / [data-rank-members] / [data-rank-providers]
 *   [data-empty-types] / [data-empty-members] / [data-empty-providers] / [data-empty-monthly]
 *
 * Os dois lados
 * -------------
 * Cada ocorrência tem um solicitante: um cooperado ou um credenciado da rede.
 * O response traz um dos pares cooperativeMember* ou credentialedProvider*
 * preenchido e o outro null; toda leitura passa por requesterOf(). O filtro de
 * relacionamento recorta indicadores, gráfico e rankings; o painel cooperado ×
 * rede é a exceção, porque é justamente a comparação que o filtro esconderia.
 *
 * De onde vêm os números
 * ----------------------
 * Tudo sai de GET /api/v1/occurrences, agregado aqui no navegador — não há
 * endpoint de resumo. É a mesma escolha da listagem (js/pages/occurrences.js):
 * no volume de uma secretaria executiva, uma consulta só e a conta local saem
 * mais baratas que somar no banco a cada troca de recorte. Quando o histórico
 * pesar, o caminho é um GET /api/v1/occurrences/summary agregando no service,
 * e só as funções de contagem daqui mudam.
 *
 * Sobre as cores: nenhuma vive neste arquivo. As marcas leem as classes
 * .chart__bar--member/--network e .rank__part--*, que apontam para os tokens
 * --color-relation-* de tokens.css.
 */

import {notifyError} from "../utils/notyf.js";

const OCCURRENCES_URL = "/certificados-cooperados/api/v1/occurrences";
const MEMBERS_URL = "/certificados-cooperados/api/v1/cooperative-members";
const PROVIDERS_URL = "/certificados-cooperados/api/v1/credentialed-providers";

/** Quantas barras cada ranking mostra antes de juntar o resto em "Outros".
 *  Sete é o teto em que classes vizinhas ainda se distinguem. */
const RANK_LIMIT = 7;

const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const SIDES = ["cooperado", "rede"];

const SIDE_LABELS = {cooperado: "Cooperado", rede: "Rede"};

/** Tudo que a API devolveu. É a fonte de todos os recortes. */
let allOccurrences = [];

/** Totais cadastrados, só para dar denominador ao indicador de solicitantes.
 *  Ficam nulos se a consulta falhar — o indicador continua válido sem eles,
 *  então a falha não derruba o painel. */
let registeredMembers = null;
let registeredProviders = null;

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
   Solicitante
   ========================================================================= */

/**
 * Lê o solicitante de uma ocorrência, seja qual for o lado. `key` junta lado e
 * id porque cooperado e credenciado vêm de tabelas diferentes e podem ter o
 * mesmo id.
 */
function requesterOf(occurrence) {
    if (occurrence.credentialedProviderId !== null && occurrence.credentialedProviderId !== undefined) {
        return {
            side: "rede",
            key: `p:${occurrence.credentialedProviderId}`,
            name: occurrence.credentialedProviderName ?? "",
        };
    }

    return {
        side: "cooperado",
        key: `m:${occurrence.cooperativeMemberId}`,
        name: occurrence.cooperativeMemberName ?? "",
    };
}

const sideOf = occurrence => requesterOf(occurrence).side;

/* =========================================================================
   Agregação
   ========================================================================= */

/**
 * Conta ocorrências por chave e devolve {label, value, cooperado, rede} do
 * maior para o menor. As duas partes vão junto para a barra do ranking de tipos
 * poder mostrar quanto de cada lado está por trás do total. Empate desempata
 * pelo rótulo, em pt-BR, para a ordem não depender da ordem da API.
 */
function countBy(occurrences, keyOf) {
    const counts = new Map();

    occurrences.forEach(occurrence => {
        const key = keyOf(occurrence);
        if (key === null || key === undefined || key === "") return;

        const entry = counts.get(key) ?? {label: key, value: 0, cooperado: 0, rede: 0};
        entry.value += 1;
        entry[sideOf(occurrence)] += 1;
        counts.set(key, entry);
    });

    return [...counts.values()].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR"));
}

/**
 * Corta a lista no teto de barras e junta a cauda em uma linha só.
 *
 * "Outros" não é uma categoria do cadastro: é a soma do que não coube. Por isso
 * vem com a contagem de classes que representa — sem isso a barra viraria uma
 * categoria fantasma, e ainda por cima grande.
 */
function withTail(items, [singular, pluralWord], limit = RANK_LIMIT) {
    if (items.length <= limit) return items.map(item => ({...item, tail: false}));

    const head = items.slice(0, limit).map(item => ({...item, tail: false}));
    const tail = items.slice(limit);

    const sum = field => tail.reduce((total, item) => total + item[field], 0);

    return [...head, {
        label: `Outros (${plural(tail.length, singular, pluralWord)})`,
        value: sum("value"),
        cooperado: sum("cooperado"),
        rede: sum("rede"),
        tail: true,
    }];
}

/**
 * Os meses que o gráfico desenha, no recorte escolhido, com as duas partes.
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
        if (!key) return;

        const entry = counts.get(key) ?? {cooperado: 0, rede: 0};
        entry[sideOf(occurrence)] += 1;
        counts.set(key, entry);
    });

    const today = new Date();
    const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

    const monthOf = (key, label) => {
        const entry = counts.get(key) ?? {cooperado: 0, rede: 0};
        return {
            key,
            label,
            cooperado: entry.cooperado,
            rede: entry.rede,
            value: entry.cooperado + entry.rede,
            current: key === currentKey,
        };
    };

    if (year) {
        return MONTH_LABELS.map((label, index) => monthOf(`${year}-${String(index + 1).padStart(2, "0")}`, label));
    }

    const months = [];

    for (let back = 11; back >= 0; back -= 1) {
        const date = new Date(today.getFullYear(), today.getMonth() - back, 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        months.push(monthOf(key, MONTH_LABELS[date.getMonth()]));
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
   Recorte
   ========================================================================= */

const readYear = () => document.querySelector("[data-period-filter]").value;

const readRelation = () => document.querySelector("[data-relation-filter] input:checked")?.value ?? "";

const byYear = (occurrences, year) =>
    (year ? occurrences.filter(occurrence => yearOf(occurrence) === year) : occurrences);

const byRelation = (occurrences, relation) =>
    (relation ? occurrences.filter(occurrence => sideOf(occurrence) === relation) : occurrences);

/* =========================================================================
   Indicadores
   ========================================================================= */

function setKpi(name, value, note) {
    document.querySelector(`[data-kpi-${name}]`).textContent = value;
    // textContent: nome de tipo vem do banco.
    document.querySelector(`[data-kpi-${name}-note]`).textContent = note ?? "";
}

function renderKpis(scoped, year, relation) {
    const total = scoped.length;

    // 1. O indicador obrigatório. Com um ano escolhido, a nota compara com o
    //    ano anterior no mesmo relacionamento — comparar a rede deste ano com
    //    tudo do ano passado seria comparar coisas diferentes.
    if (year) {
        const previousYear = Number(year) - 1;
        const sameRelation = byRelation(allOccurrences, relation);
        const previous = sameRelation.filter(occurrence => Number(yearOf(occurrence)) === previousYear).length;

        if (previous) {
            const difference = total - previous;

            // O sinal é escrito à mão: o "+" não sai da formatação, e é ele que
            // diz que ali está uma variação, não um segundo total.
            setKpi("total", formatNumber(total),
                `${difference >= 0 ? "+" : "−"}${formatNumber(Math.abs(difference))} em relação a ${previousYear}`);
        } else {
            const earlier = sameRelation.some(occurrence => Number(yearOf(occurrence)) < previousYear);

            setKpi("total", formatNumber(total),
                earlier ? `Nenhuma manifestação em ${previousYear}` : "Primeiro ano com registro");
        }
    } else {
        const months = elapsedMonths(scoped, "");
        setKpi("total", formatNumber(total), months ? `Em ${plural(months, "mês de histórico", "meses de histórico")}` : "");
    }

    // 2. Alcance: quantos solicitantes diferentes estão por trás desse volume.
    //    Com um lado filtrado, o denominador é o cadastro daquele lado; com os
    //    dois, a nota separa quantos são de cada um.
    const requesters = new Map();
    scoped.forEach(occurrence => {
        const requester = requesterOf(occurrence);
        requesters.set(requester.key, requester.side);
    });

    const distinct = side => [...requesters.values()].filter(value => value === side).length;

    let requestersNote = "";

    if (relation === "cooperado") {
        requestersNote = registeredMembers === null ? "Cooperados distintos"
            : `de ${plural(registeredMembers, "cooperado cadastrado", "cooperados cadastrados")}`;
    } else if (relation === "rede") {
        requestersNote = registeredProviders === null ? "Credenciados distintos"
            : `de ${plural(registeredProviders, "credenciado cadastrado", "credenciados cadastrados")}`;
    } else if (requesters.size) {
        requestersNote = `${plural(distinct("cooperado"), "cooperado", "cooperados")} e `
            + `${plural(distinct("rede"), "credenciado", "credenciados")}`;
    }

    setKpi("requesters", formatNumber(requesters.size), requestersNote);

    // 3. Ritmo. Divide pelos meses corridos, e não pelos meses com lançamento:
    //    mês sem manifestação é informação, não ausência de dado.
    const months = elapsedMonths(scoped, year);

    setKpi("average", months ? formatDecimal(total / months) : "—",
        months ? `Em ${plural(months, "mês", "meses")} de calendário` : "");

    // 4. Concentração: diz se a demanda se espalha ou se mora quase toda em um
    //    assunto só — que é o que decide onde mexer primeiro.
    const types = countBy(scoped, occurrence => occurrence.occurrenceTypeName);

    if (types.length) {
        setKpi("top-type", `${share(types[0].value, total)}%`, types[0].label);
    } else {
        setKpi("top-type", "—", "");
    }
}

/* =========================================================================
   Cooperado e rede

   Recorta só pelo período: é a comparação entre os dois lados, e o filtro de
   relacionamento serve só para acender o lado escolhido.
   ========================================================================= */

function renderRelation(periodScoped, relation, year) {
    const panel = document.querySelector(".relation");
    const total = periodScoped.length;

    const counts = {cooperado: 0, rede: 0};
    const reach = {cooperado: new Set(), rede: new Set()};

    periodScoped.forEach(occurrence => {
        const requester = requesterOf(occurrence);
        counts[requester.side] += 1;
        reach[requester.side].add(requester.key);
    });

    // A barra usa a conta exata, e não o percentual arredondado, para as duas
    // partes somarem a largura inteira.
    const bar = document.querySelector("[data-relation-bar]");
    bar.style.setProperty("--share-member", total ? `${(counts.cooperado / total) * 100}%` : "0%");
    bar.style.setProperty("--share-network", total ? `${(counts.rede / total) * 100}%` : "0%");
    bar.classList.toggle("is-empty", total === 0);

    // O percentual da rede sai como complemento, para os dois somarem 100.
    const memberShare = share(counts.cooperado, total);
    const shares = {cooperado: memberShare, rede: total ? 100 - memberShare : 0};

    SIDES.forEach(side => {
        document.querySelector(`[data-relation-share="${side}"]`).textContent = total ? `${shares[side]}%` : "—";
        document.querySelector(`[data-relation-count="${side}"]`).textContent =
            plural(counts[side], "manifestação", "manifestações");
        document.querySelector(`[data-relation-reach="${side}"]`).textContent = side === "cooperado"
            ? plural(reach.cooperado.size, "cooperado distinto", "cooperados distintos")
            : plural(reach.rede.size, "credenciado distinto", "credenciados distintos");
    });

    panel.dataset.focus = relation;

    document.querySelector("[data-relation-caption]").textContent = year
        ? `Divisão das manifestações de ${year}.`
        : "Divisão de todas as manifestações registradas.";
}

/* =========================================================================
   Gráfico de colunas empilhadas — manifestações por mês

   SVG desenhado em pixels reais, e não em viewBox esticada: com viewBox o texto
   escalaria junto com a largura do card e os rótulos ficariam minúsculos no
   celular e enormes no monitor. Por isso o desenho é refeito quando o card muda
   de tamanho (ResizeObserver, mais abaixo).

   Cooperado embaixo, rede em cima. Entre as duas partes fica um vão de 2px da
   cor da superfície, que é o que separa os segmentos sem desenhar contorno.
   ========================================================================= */

const SVG_NS = "http://www.w3.org/2000/svg";

const CHART = {
    height: 280,
    paddingTop: 20,
    paddingRight: 8,
    paddingBottom: 28,  // a faixa do eixo x entra na altura: sem isso o card ganharia um scroll interno só para os rótulos
    paddingLeft: 40,
    maxBarWidth: 24,    // barra fina; a sobra da faixa é ar, não preenchimento
    barRadius: 4,
    segmentGap: 2,
    tickCount: 4,
};

function svgElement(name, attributes = {}) {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
    return element;
}

/**
 * Régua do eixo y em números redondos: 7 vira 0-2-4-6-8, 23 vira 0-10-20-30.
 *
 * O passo nunca é fracionário — são manifestações contadas — e o teto é o
 * primeiro múltiplo do passo acima do maior valor, para um pico de 23 não
 * levar o teto a 40 e achatar o gráfico inteiro.
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

// Retângulo com o topo arredondado e a base reta. Só o segmento de cima da
// pilha leva o arredondamento: é ele a ponta do dado.
function barPath(x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height));

    return `M${x} ${y + height} L${x} ${y + r} Q${x} ${y} ${x + r} ${y}`
        + ` L${x + width - r} ${y} Q${x + width} ${y} ${x + width} ${y + r}`
        + ` L${x + width} ${y + height} Z`;
}

function rectPath(x, y, width, height) {
    return `M${x} ${y} H${x + width} V${y + height} H${x} Z`;
}

// As partes que o filtro deixa em cena, na ordem da pilha (de baixo para cima).
const visibleSides = relation => (relation ? [relation] : SIDES);

function tooltipParts(month, relation) {
    return relation ? [] : SIDES.map(side => ({side, value: month[side]}));
}

function renderMonthlyChart(series, relation) {
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

    const sides = visibleSides(relation);
    const totalOf = month => sides.reduce((sum, side) => sum + month[side], 0);

    const scale = niceScale(Math.max(...series.map(totalOf)));
    const bandWidth = plotWidth / series.length;
    const barWidth = Math.max(6, Math.min(CHART.maxBarWidth, bandWidth - 12));

    // O total de cada coluna vai em cima dela, desde que a faixa comporte o
    // número mais largo. Se não comportar, ninguém recebe rótulo e o valor fica
    // com o eixo, o hover e a tabela — melhor nenhum do que texto colado no
    // vizinho.
    const widestLabel = formatNumber(scale.max).length * 7;
    const showValueLabels = bandWidth >= widestLabel + 4;

    // role="group", e não role="img": as faixas dos meses são focáveis e têm
    // rótulo próprio, e role="img" as esconderia do leitor de tela.
    const svg = svgElement("svg", {
        width, height, role: "group", "aria-label": "Manifestações por mês",
    });

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
        const total = totalOf(month);
        const barTop = baseline - (total / scale.max) * plotHeight;

        const band = svgElement("g", {class: "chart__band"});

        // Empilha de baixo para cima. O vão de 2px sai da altura do segmento de
        // cima, para o topo da pilha continuar no valor certo do eixo.
        const filled = sides.filter(side => month[side] > 0);
        let cursor = baseline;

        filled.forEach((side, position) => {
            const isTop = position === filled.length - 1;
            const fullHeight = (month[side] / scale.max) * plotHeight;
            const gap = position > 0 ? CHART.segmentGap : 0;
            const segmentHeight = Math.max(1, fullHeight - gap);
            // O segmento começa no topo da sua fatia e para 2px antes do de
            // baixo: o vão fica entre os dois, e o topo da pilha não se move.
            const y = cursor - fullHeight;

            const classes = ["chart__bar", side === "rede" ? "chart__bar--network" : "chart__bar--member"];
            // O mês em curso ainda não terminou: desenhado cheio, a coluna menor
            // pareceria queda, quando é só mês pela metade.
            if (month.current) classes.push("chart__bar--partial");

            band.appendChild(svgElement("path", {
                d: isTop
                    ? barPath(barX, y, barWidth, segmentHeight, CHART.barRadius)
                    : rectPath(barX, y, barWidth, segmentHeight),
                class: classes.join(" "),
            }));

            cursor -= fullHeight;
        });

        const tickLabel = svgElement("text", {
            x: bandX + bandWidth / 2, y: height - 10, "text-anchor": "middle", class: "chart__tick",
        });
        tickLabel.textContent = month.label;
        svg.appendChild(tickLabel);

        // Mês zerado não recebe rótulo: um "0" sobre a linha de base não diz
        // nada que a coluna ausente já não diga.
        if (total > 0 && showValueLabels) {
            const valueLabel = svgElement("text", {
                x: barX + barWidth / 2, y: barTop - 8, "text-anchor": "middle", class: "chart__value",
            });
            valueLabel.textContent = formatNumber(total);
            svg.appendChild(valueLabel);
        }

        const parts = tooltipParts(month, relation);
        const partsLabel = parts.length
            ? ` (${parts.map(part => `${SIDE_LABELS[part.side]} ${formatNumber(part.value)}`).join(", ")})`
            : "";

        // Alvo do ponteiro: a faixa inteira, não a barra. Mirar em coluna de
        // 24px (ou em coluna de altura zero) é exigência que ninguém cumpre.
        const hit = svgElement("rect", {
            x: bandX, y: paddingTop, width: bandWidth, height: plotHeight,
            class: "chart__hit", tabindex: "0", role: "img",
            "aria-label": `${formatMonthKey(month.key)}: ${plural(total, "manifestação", "manifestações")}${partsLabel}`,
        });

        const show = () => showTooltip(host, bandX + bandWidth / 2, total > 0 ? barTop : baseline,
            formatMonthKey(month.key), plural(total, "manifestação", "manifestações"), parts);

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

function showTooltip(host, x, y, title, value, parts) {
    const tooltip = host.querySelector("[data-tooltip]");

    // O total lidera e o mês segue: quem já está com o ponteiro no mês quer o
    // número, não o nome do mês de novo. As partes vêm por último.
    tooltip.querySelector("[data-tooltip-value]").textContent = value;
    tooltip.querySelector("[data-tooltip-label]").textContent = title;

    const list = tooltip.querySelector("[data-tooltip-parts]");
    list.innerHTML = "";

    parts.forEach(part => {
        const item = document.createElement("li");
        item.className = "chart__tooltip-part";

        const swatch = document.createElement("i");
        swatch.className = `dash-swatch ${part.side === "rede" ? "dash-swatch--network" : "dash-swatch--member"}`;
        swatch.setAttribute("aria-hidden", "true");

        const amount = document.createElement("strong");
        amount.textContent = formatNumber(part.value);

        item.append(swatch, SIDE_LABELS[part.side], amount);
        list.appendChild(item);
    });

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
// nem de ponteiro. Mostra sempre as duas partes, mesmo com um lado filtrado —
// o zero do outro lado também é informação.
function renderMonthlyTable(series, relation) {
    const tbody = document.querySelector("[data-monthly-table]");
    tbody.innerHTML = "";

    const fragment = document.createDocumentFragment();

    series.forEach(month => {
        const row = document.createElement("tr");

        const label = document.createElement("th");
        label.setAttribute("scope", "row");
        label.textContent = formatMonthKey(month.key);
        row.appendChild(label);

        const total = visibleSides(relation).reduce((sum, side) => sum + month[side], 0);

        [month.cooperado, month.rede, total].forEach(value => {
            const cell = document.createElement("td");
            cell.className = "table__num tabular";
            cell.textContent = formatNumber(value);
            row.appendChild(cell);
        });

        fragment.appendChild(row);
    });

    tbody.appendChild(fragment);
}

/* =========================================================================
   Rankings

   Barra em HTML, e não em SVG: são rótulos longos, que o texto corrido quebra
   sozinho e o SVG só cortaria. Cada linha carrega rótulo e valor como texto de
   verdade, então a lista já é a própria tabela.
   ========================================================================= */

/**
 * `split` liga a barra dividida (cooperado | rede), usada no ranking de
 * tipos. Nos rankings de solicitantes a barra tem uma parte só, a do lado.
 */
function renderRanking(selector, items, total, {split = false, side = "cooperado", relation = ""} = {}) {
    const list = document.querySelector(selector);
    list.innerHTML = "";

    // A escala é o maior do recorte, e não o total: com o total, uma cauda de
    // categorias pequenas viraria barras rentes ao chão, todas iguais.
    const highest = Math.max(...items.map(item => item.value), 1);

    const fragment = document.createDocumentFragment();

    items.forEach(item => {
        const row = document.createElement("li");
        row.className = item.tail ? "rank__row rank__row--tail" : "rank__row";

        const breakdown = split && !relation
            ? ` (${formatNumber(item.cooperado)} de cooperado, ${formatNumber(item.rede)} da rede)`
            : "";
        row.title = `${item.label}: ${share(item.value, total)}% do recorte${breakdown}`;

        const label = document.createElement("p");
        label.className = "rank__label";
        // textContent: o nome vem do cadastro.
        label.textContent = item.label;

        const value = document.createElement("p");
        value.className = "rank__value tabular";
        value.textContent = formatNumber(item.value);

        const track = document.createElement("div");
        track.className = "rank__track";

        const fill = document.createElement("div");
        fill.className = "rank__fill";
        fill.style.width = `${(item.value / highest) * 100}%`;

        const parts = split ? visibleSides(relation) : [side];

        parts.forEach(partSide => {
            const amount = split ? item[partSide] : item.value;
            if (!amount) return;

            const part = document.createElement("span");
            part.className = `rank__part ${partSide === "rede" ? "rank__part--network" : "rank__part--member"}`;
            // flex-grow na proporção da parte: a soma ocupa o fill inteiro, já
            // descontados os 2px de vão entre as duas.
            part.style.flex = `${amount} 1 0`;
            fill.appendChild(part);
        });

        track.appendChild(fill);

        // A barra vai por último no DOM de propósito: a linha é uma grade de
        // duas colunas em que ela ocupa as duas, e o leitor de tela ouve nome e
        // número antes do enfeite.
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

const describeRelation = relation =>
    ({cooperado: " de cooperados", rede: " da rede"})[relation] ?? "";

function currentScopes() {
    const year = readYear();
    const relation = readRelation();
    const periodScoped = byYear(allOccurrences, year);

    return {year, relation, periodScoped, scoped: byRelation(periodScoped, relation)};
}

function render() {
    const {year, relation, periodScoped, scoped} = currentScopes();

    renderKpis(scoped, year, relation);
    renderRelation(periodScoped, relation, year);

    // Gráfico -------------------------------------------------------------
    const series = monthlySeries(scoped, year);
    const hasMonthlyData = series.some(month => month.value > 0);

    toggleEmpty("[data-empty-monthly]", !hasMonthlyData);
    document.querySelector("[data-chart-monthly]").hidden = !hasMonthlyData;

    // O vazio do gráfico precisa dizer de que janela está falando. Em "todo o
    // período" o eixo são os últimos doze meses, e uma base inteira mais antiga
    // que isso deixaria o gráfico vazio ao lado de rankings cheios.
    document.querySelector("[data-empty-monthly]").textContent = year
        ? `Nenhuma manifestação${describeRelation(relation)} registrada em ${year}.`
        : `Nenhuma manifestação${describeRelation(relation)} registrada nos últimos doze meses.`;

    if (hasMonthlyData) renderMonthlyChart(series, relation);
    renderMonthlyTable(series, relation);

    // A nota do tom mais claro só aparece quando existe mesmo uma coluna
    // parcial desenhada.
    document.querySelector("[data-partial-note]").hidden =
        !series.some(month => month.current && month.value > 0);

    document.querySelector("[data-monthly-caption]").textContent = year
        ? `Manifestações${describeRelation(relation)} por mês em ${year}.`
        : `Manifestações${describeRelation(relation)} por mês nos últimos doze meses.`;

    // Com um lado filtrado a legenda mostra só ele: a outra série não está
    // desenhada.
    document.querySelectorAll("[data-legend]").forEach(item => {
        item.hidden = Boolean(relation) && item.dataset.legend !== relation;
    });

    // Rankings ------------------------------------------------------------
    const types = withTail(countBy(scoped, occurrence => occurrence.occurrenceTypeName), ["tipo", "tipos"]);

    const membersScoped = scoped.filter(occurrence => sideOf(occurrence) === "cooperado");
    const providersScoped = scoped.filter(occurrence => sideOf(occurrence) === "rede");

    const members = withTail(countBy(membersScoped, o => requesterOf(o).name), ["cooperado", "cooperados"]);
    const providers = withTail(countBy(providersScoped, o => requesterOf(o).name), ["credenciado", "credenciados"]);

    toggleEmpty("[data-empty-types]", !types.length);
    toggleEmpty("[data-empty-members]", !members.length);
    toggleEmpty("[data-empty-providers]", !providers.length);

    renderRanking("[data-rank-types]", types, scoped.length, {split: true, relation});
    renderRanking("[data-rank-members]", members, membersScoped.length, {side: "cooperado"});
    renderRanking("[data-rank-providers]", providers, providersScoped.length, {side: "rede"});

    // O ranking do lado que o filtro tirou de cena some, em vez de ficar
    // vazio dizendo "nenhuma manifestação" — o que pareceria falta de dado.
    document.querySelectorAll("[data-rank-card]").forEach(card => {
        card.hidden = Boolean(relation) && card.dataset.rankCard !== relation;
    });
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

// Só para o denominador do indicador de solicitantes. Falha aqui não pode
// derrubar o painel: o número de atendidos continua de pé sem o total.
async function loadCount(url) {
    try {
        const response = await fetch(url, {credentials: "same-origin"});
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
        const [occurrences, members, providers] = await Promise.all([
            loadOccurrences(),
            loadCount(MEMBERS_URL),
            loadCount(PROVIDERS_URL),
        ]);

        allOccurrences = occurrences;
        registeredMembers = members;
        registeredProviders = providers;

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
            const {year, relation, scoped} = currentScopes();
            renderMonthlyChart(monthlySeries(scoped, year), relation);
        });
    }).observe(host);
}

function init() {
    document.querySelector("[data-period-filter]").addEventListener("change", render);
    document.querySelector("[data-relation-filter]").addEventListener("change", render);

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
