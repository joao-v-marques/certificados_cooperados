/**
 * Página de credenciados: duas abas, uma para os credenciados e outra para os
 * tipos de credenciado. Cada aba lista, filtra, cadastra, edita e
 * desativa/reativa.
 *
 * Endpoints (todos sob o context-path da aplicação):
 *   GET   /api/v1/credentialed-providers                  lista com ativos e inativos
 *   POST  /api/v1/credentialed-providers                  {name, email, typeId} → 201
 *   PUT   /api/v1/credentialed-providers/{id}             {name, email, typeId} → 200
 *   PATCH /api/v1/credentialed-providers/{id}/deactivate  sem corpo → 200
 *   PATCH /api/v1/credentialed-providers/{id}/reactivate  sem corpo → 200
 *
 *   GET   /api/v1/credentialed-provider-types             lista com ativos e inativos, por nome
 *   POST  /api/v1/credentialed-provider-types             {name} → 201
 *   PUT   /api/v1/credentialed-provider-types/{id}        {name} → 200
 *   PATCH /api/v1/credentialed-provider-types/{id}/deactivate
 *   PATCH /api/v1/credentialed-provider-types/{id}/reactivate
 *
 * O backend só aceita credenciado com tipo ativo, por isso o select do
 * formulário oferece apenas os ativos.
 *
 * Contrato com o HTML (data-*):
 *   [data-tabs]                    tablist; [data-tab="<aba>"] em cada aba
 *   [data-tabs-indicator]          marca deslizante da aba selecionada
 *   [data-tab-count="<aba>"]       contagem ao lado do rótulo da aba
 *   [data-panel="<aba>"]           painel de cada aba
 *   [data-create-provider]         abre o cadastro de credenciado
 *   [data-create-type]             abre o cadastro de tipo
 *   [data-provider-filters]        barra de filtros dos credenciados
 *   [data-type-filters]            barra de filtros dos tipos
 *   [data-filter-clear="<aba>"]    zera os filtros da aba
 *   [data-empty="<aba>"]           estado vazio, com [data-empty-title],
 *                                  [data-empty-text] e [data-empty-action]
 *   [data-table-count="<aba>"]     rodapé com a contagem da tabela
 *   [data-provider-modal]          <dialog> do cadastro/edição de credenciado
 *   [data-provider-form]           formulário dentro dele
 *   [data-provider-type-hint]      dica do select de tipo
 *   [data-type-modal]              <dialog> do cadastro/edição de tipo
 *   [data-type-form]               formulário dentro dele
 *   [data-modal-title], [data-modal-subtitle], [data-form-error],
 *   [data-form-submit]             partes de cada modal de formulário
 *   [data-status-modal]            <dialog> da confirmação de situação, com
 *                                  [data-status-title], [data-status-question],
 *                                  [data-status-name], [data-status-warning],
 *                                  [data-status-error] e [data-status-confirm]
 *   [data-modal-close]             qualquer botão que fecha o modal em que está
 *
 * Nas linhas da tabela:
 *   [data-edit="<id>"]    abre a edição
 *   [data-status="<id>"]  abre a confirmação de situação
 *
 * O retorno de sucesso sai em toast (ver utils/notyf.js); o erro de campo
 * fica no <p class="field__error"> dele, e a recusa dentro de um modal vai
 * para o rodapé do próprio modal, porque o <dialog> cobre o toast.
 */

import {dismissNotifications, notifyError, notifySuccess} from "../utils/notyf.js";

const PROVIDERS_URL = "/certificados-cooperados/api/v1/credentialed-providers";
const TYPES_URL = "/certificados-cooperados/api/v1/credentialed-provider-types";

const TABS = ["credenciados", "tipos"];

// A aba de credenciados é a padrão e fica sem hash; a de tipos vai para #tipos.
const TAB_HASH = {credenciados: "", tipos: "#tipos"};

const PROVIDER_FIELDS = {
    name: {inputId: "credenciado-nome", errorId: "erro-credenciado-nome"},
    email: {inputId: "credenciado-email", errorId: "erro-credenciado-email"},
    typeId: {inputId: "credenciado-tipo", errorId: "erro-credenciado-tipo"},
};

const TYPE_FIELDS = {
    name: {inputId: "tipo-nome", errorId: "erro-tipo-nome"},
};

const TYPE_HINT = "Só aparecem os tipos ativos. Para criar um novo, use a aba de tipos.";

/**
 * Último resultado dos dois GETs. Os modais e os filtros trabalham daqui, sem
 * nova chamada: a listagem já traz tudo que as telas mostram.
 */
let providers = [];
let types = [];
const providersById = new Map();
const typesById = new Map();

/* =========================================================================
   Texto vindo do banco
   ========================================================================= */

/**
 * Nome e e-mail são digitados pelo usuário e voltam da API, então não podem
 * ser interpolados crus — nem na tabela nem no toast, que o Notyf grava com
 * innerHTML.
 */
function escapeHtml(value) {
    const characters = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"};
    return String(value ?? "").replace(/[&<>"']/g, character => characters[character]);
}

// Busca sem acento e sem caixa: "clinica" encontra "Clínica".
function normalize(value) {
    return String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {day: "2-digit", month: "2-digit", year: "numeric"});

function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : dateFormatter.format(date);
}

function plural(count, singular, pluralForm) {
    return count === 1 ? `1 ${singular}` : `${count} ${pluralForm}`;
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
   Chamadas à API

   Todas passam por aqui para o 401 ter um tratamento só: sessão expirada volta
   para o login em vez de virar "não foi possível salvar".
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

    // Corpo vazio ou resposta que não é JSON não podem derrubar a leitura.
    const parsed = await response.json().catch(() => null);

    return {ok: response.ok, status: response.status, body: parsed};
}

function messageOf(result, fallback) {
    return result.body?.message || fallback;
}

function fieldsOf(result) {
    return result.body?.fields ?? {};
}

/* =========================================================================
   Abas
   ========================================================================= */

let activeTab = "credenciados";

function tabFromHash() {
    return window.location.hash === TAB_HASH.tipos ? "tipos" : "credenciados";
}

// A marca deslizante é medida na aba selecionada, porque a largura das duas
// muda com o rótulo e com a contagem.
function moveIndicator() {
    const tablist = document.querySelector("[data-tabs]");
    const tab = tablist.querySelector(`[data-tab="${activeTab}"]`);

    tablist.style.setProperty("--tab-x", `${tab.offsetLeft}px`);
    tablist.style.setProperty("--tab-w", `${tab.offsetWidth}px`);
}

function selectTab(name, {focus = false, updateHash = true} = {}) {
    activeTab = name;

    document.querySelectorAll("[data-tab]").forEach(tab => {
        const selected = tab.dataset.tab === name;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
        if (selected && focus) tab.focus();
    });

    document.querySelectorAll("[data-panel]").forEach(panel => {
        panel.hidden = panel.dataset.panel !== name;
    });

    // O botão de cadastro do cabeçalho é o da aba aberta.
    document.querySelector("[data-create-provider]").hidden = name !== "credenciados";
    document.querySelector("[data-create-type]").hidden = name !== "tipos";

    // replaceState, e não location.hash: trocar de aba não deve encher o
    // histórico a ponto de o "voltar" do navegador só alternar abas.
    if (updateHash) {
        const url = `${window.location.pathname}${window.location.search}${TAB_HASH[name]}`;
        history.replaceState(null, "", url);
    }

    moveIndicator();
}

function initTabs() {
    const tablist = document.querySelector("[data-tabs]");
    if (!tablist) return;

    tablist.addEventListener("click", event => {
        const tab = event.target.closest("[data-tab]");
        if (tab) selectTab(tab.dataset.tab);
    });

    // Setas, Home e End andam entre as abas, como pede o padrão de tablist.
    tablist.addEventListener("keydown", event => {
        const index = TABS.indexOf(activeTab);
        const moves = {
            ArrowRight: (index + 1) % TABS.length,
            ArrowLeft: (index - 1 + TABS.length) % TABS.length,
            Home: 0,
            End: TABS.length - 1,
        };

        if (!(event.key in moves)) return;

        event.preventDefault();
        selectTab(TABS[moves[event.key]], {focus: true});
    });

    // Hash editado na mão ou link colado com a página aberta.
    window.addEventListener("hashchange", () => selectTab(tabFromHash(), {updateHash: false}));

    // A largura das abas muda com a fonte carregada e com a contagem que chega
    // da API; observar o trilho cobre os dois casos.
    if ("ResizeObserver" in window) {
        new ResizeObserver(moveIndicator).observe(tablist);
    } else {
        window.addEventListener("resize", moveIndicator);
    }

    selectTab(tabFromHash(), {updateHash: false});

    // Só depois da primeira medição a marca passa a deslizar; sem isto, abrir
    // direto em #tipos mostraria ela vindo do canto esquerdo.
    requestAnimationFrame(() => tablist.classList.add("is-ready"));
}

/* =========================================================================
   Carga das listas
   ========================================================================= */

async function loadAll() {
    try {
        // Em paralelo, e sempre os dois: renomear ou desativar um tipo muda a
        // coluna "Tipo" dos credenciados e o select do formulário.
        const [providersResult, typesResult] = await Promise.all([
            apiRequest(PROVIDERS_URL),
            apiRequest(TYPES_URL),
        ]);
        if (!providersResult || !typesResult) return;

        if (!providersResult.ok || !typesResult.ok) {
            throw new Error(`A API respondeu ${providersResult.status} / ${typesResult.status}`);
        }

        providers = Array.isArray(providersResult.body) ? providersResult.body : [];
        types = Array.isArray(typesResult.body) ? typesResult.body : [];

        // Credenciados em ordem alfabética: a API devolve na ordem do banco.
        providers.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

        providersById.clear();
        typesById.clear();
        providers.forEach(provider => providersById.set(String(provider.id), provider));
        types.forEach(type => typesById.set(String(type.id), type));

        renderTypeFilterOptions();
        updateSummaries();
        renderProviders();
        renderTypes();
    } catch (error) {
        // Falha de rede não é "nenhum cadastro" — os estados vazios continuam
        // ocultos para não mentir sobre o que existe.
        document.querySelectorAll("[data-empty]").forEach(empty => { empty.hidden = true; });
        document.querySelectorAll("[data-table-count]").forEach(count => { count.textContent = ""; });

        notifyError("Não foi possível carregar os credenciados. Atualize a página.");
        console.error(error);
    }
}

const activeTypes = () => types.filter(type => type.isActive);

function updateSummaries() {
    const providersActive = providers.filter(provider => provider.isActive).length;
    const typesActive = activeTypes().length;

    document.getElementById("cardProvidersQtd").textContent = providers.length;
    document.getElementById("cardProvidersActiveQtd").textContent = providersActive;
    document.getElementById("cardProvidersInactiveQtd").textContent = providers.length - providersActive;

    document.getElementById("cardTypesQtd").textContent = types.length;
    document.getElementById("cardTypesActiveQtd").textContent = typesActive;
    document.getElementById("cardTypesInactiveQtd").textContent = types.length - typesActive;

    document.querySelector('[data-tab-count="credenciados"]').textContent = providers.length;
    document.querySelector('[data-tab-count="tipos"]').textContent = types.length;

    // Sem tipo ativo o backend recusaria qualquer cadastro; o estado vazio
    // explica o porquê e leva para a aba de tipos.
    const createButton = document.querySelector("[data-create-provider]");
    createButton.disabled = typesActive === 0;
    createButton.title = typesActive === 0 ? "Cadastre ou reative um tipo de credenciado primeiro" : "";

    moveIndicator();
}

/* =========================================================================
   Filtros

   Aplicados no navegador sobre a lista que já chegou.
   ========================================================================= */

function readProviderFilters() {
    return {
        search: normalize(document.getElementById("filtro-credenciado").value),
        typeId: document.getElementById("filtro-credenciado-tipo").value,
        status: document.getElementById("filtro-credenciado-situacao").value,
    };
}

function readTypeFilters() {
    return {
        search: normalize(document.getElementById("filtro-tipo").value),
        status: document.getElementById("filtro-tipo-situacao").value,
    };
}

const hasActiveFilters = filters => Object.values(filters).some(value => value !== "");

function matchesStatus(item, status) {
    if (status === "ativo") return item.isActive;
    if (status === "inativo") return !item.isActive;
    return true;
}

// O filtro de tipo oferece todos, inclusive os desativados: é justamente para
// achar quem ainda está vinculado a um tipo que saiu de uso.
function renderTypeFilterOptions() {
    const select = document.getElementById("filtro-credenciado-tipo");
    const current = select.value;

    select.innerHTML = `<option value="">Todos os tipos</option>`;

    types.forEach(type => {
        const option = document.createElement("option");
        option.value = String(type.id);
        option.textContent = type.isActive ? type.name : `${type.name} (desativado)`;
        select.appendChild(option);
    });

    // Mantém a escolha depois de um recarregamento, se o tipo ainda existir.
    select.value = typesById.has(current) ? current : "";
}

function clearFilters(tab) {
    const container = document.querySelector(tab === "tipos" ? "[data-type-filters]" : "[data-provider-filters]");
    container.querySelectorAll("input, select").forEach(element => { element.value = ""; });

    if (tab === "tipos") renderTypes();
    else renderProviders();
}

function initFilters() {
    const providerFilters = document.querySelector("[data-provider-filters]");
    const typeFilters = document.querySelector("[data-type-filters]");

    providerFilters.addEventListener("input", renderProviders);
    providerFilters.addEventListener("change", renderProviders);
    typeFilters.addEventListener("input", renderTypes);
    typeFilters.addEventListener("change", renderTypes);

    document.querySelectorAll("[data-filter-clear]").forEach(button => {
        button.addEventListener("click", () => clearFilters(button.dataset.filterClear));
    });
}

/* =========================================================================
   Estado vazio

   Um bloco por aba, com texto e ação reescritos conforme o caso: sem
   cadastro nenhum, sem tipo ativo ou com filtro sem resultado.
   ========================================================================= */

function showEmpty(tab, {title, text, action}) {
    const empty = document.querySelector(`[data-empty="${tab}"]`);
    const button = empty.querySelector("[data-empty-action]");

    empty.querySelector("[data-empty-title]").textContent = title;
    empty.querySelector("[data-empty-text]").textContent = text;

    button.hidden = !action;
    button.textContent = action?.label ?? "";
    button.dataset.action = action?.id ?? "";

    empty.hidden = false;
}

function hideEmpty(tab) {
    document.querySelector(`[data-empty="${tab}"]`).hidden = true;
}

function initEmptyActions() {
    document.querySelectorAll("[data-empty-action]").forEach(button => {
        button.addEventListener("click", () => {
            const action = button.dataset.action;

            if (action === "clear-providers") clearFilters("credenciados");
            if (action === "clear-types") clearFilters("tipos");
            if (action === "create-provider") openProviderModal(null);
            if (action === "create-type") openTypeModal(null);

            // Sem tipo ativo não dá para cadastrar credenciado: o atalho troca
            // de aba e já abre o cadastro do tipo.
            if (action === "go-types") {
                selectTab("tipos");
                openTypeModal(null);
            }
        });
    });
}

/* =========================================================================
   Ícones e botões das linhas
   ========================================================================= */

const EDIT_ICON = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M9.5 3 13 6.5 5.5 14H2v-3.5L9.5 3Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
    </svg>`;

const DEACTIVATE_ICON = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 2.5v6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        <path d="M4.6 4.6a4.8 4.8 0 1 0 6.8 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`;

const REACTIVATE_ICON = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M13.5 8a5.5 5.5 0 1 1-1.9-4.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        <path d="M13.5 2.5V6H10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

// Um gesto só, com dois sentidos: desativa o que está ativo e reativa o que
// está inativo. O ícone e o rótulo acompanham.
function rowActions(item, noun) {
    const name = escapeHtml(item.name);
    const statusClass = item.isActive ? "cred-table__action--danger" : "cred-table__action--restore";
    const statusVerb = item.isActive ? "Desativar" : "Reativar";

    return `
        <td class="table__actions">
            <button type="button" class="btn-icon cred-table__action" data-edit="${item.id}" title="Editar ${noun}">
                ${EDIT_ICON}
                <span class="visually-hidden">Editar ${name}</span>
            </button>
            <button type="button" class="btn-icon cred-table__action ${statusClass}"
                    data-status="${item.id}" title="${statusVerb} ${noun}">
                ${item.isActive ? DEACTIVATE_ICON : REACTIVATE_ICON}
                <span class="visually-hidden">${statusVerb} ${name}</span>
            </button>
        </td>`;
}

function statusBadge(item) {
    return item.isActive
        ? `<span class="badge badge--success">Ativo</span>`
        : `<span class="badge badge--negative">Desativado</span>`;
}

/* =========================================================================
   Tabela de credenciados
   ========================================================================= */

function buildProviderRow(provider) {
    const row = document.createElement("tr");
    const type = typesById.get(String(provider.typeId));

    const nameClass = provider.isActive ? "table__primary" : "table__primary cred-table__name--inactive";

    const email = provider.email
        ? `<span class="table__secondary cred-table__email">${escapeHtml(provider.email)}</span>`
        : `<span class="table__secondary cred-table__email--empty">Sem e-mail</span>`;

    // O vínculo com um tipo desativado continua valendo, mas quem for editar
    // vai precisar trocar o tipo — melhor saber disso antes de abrir o modal.
    const typeFlag = type && !type.isActive
        ? `<span class="cred-table__type-flag">Tipo desativado</span>`
        : "";

    row.innerHTML = `
        <td data-label="Credenciado">
            <span class="${nameClass}">${escapeHtml(provider.name)}</span>
            ${email}
        </td>
        <td data-label="Tipo">
            ${escapeHtml(provider.typeName)}
            ${typeFlag}
        </td>
        <td data-label="Cadastrado em" class="tabular">${formatDate(provider.createdAt)}</td>
        <td data-label="Situação">${statusBadge(provider)}</td>
        ${rowActions(provider, "credenciado")}
    `;

    return row;
}

function renderProviders() {
    const tbody = document.getElementById("tbodyProviders");
    const count = document.querySelector('[data-table-count="credenciados"]');

    const filters = readProviderFilters();
    const filtering = hasActiveFilters(filters);

    document.querySelector('[data-filter-clear="credenciados"]').disabled = !filtering;

    const visible = providers.filter(provider => {
        if (filters.search) {
            const haystack = normalize(`${provider.name} ${provider.email ?? ""}`);
            if (!haystack.includes(filters.search)) return false;
        }
        if (filters.typeId && String(provider.typeId) !== filters.typeId) return false;
        return matchesStatus(provider, filters.status);
    });

    const fragment = document.createDocumentFragment();
    visible.forEach(provider => fragment.appendChild(buildProviderRow(provider)));
    tbody.replaceChildren(fragment);

    count.textContent = filtering
        ? `${visible.length} de ${plural(providers.length, "credenciado", "credenciados")}`
        : plural(providers.length, "credenciado cadastrado", "credenciados cadastrados");

    if (providers.length === 0 && activeTypes().length === 0) {
        showEmpty("credenciados", {
            title: "Cadastre um tipo antes do primeiro credenciado",
            text: "Todo credenciado pertence a um tipo, e ainda não há nenhum tipo ativo para escolher.",
            action: {id: "go-types", label: "Cadastrar tipo"},
        });
    } else if (providers.length === 0) {
        showEmpty("credenciados", {
            title: "Nenhum credenciado cadastrado ainda",
            text: "Cadastre o primeiro credenciado para ele aparecer nesta lista.",
            action: {id: "create-provider", label: "Cadastrar credenciado"},
        });
    } else if (visible.length === 0) {
        showEmpty("credenciados", {
            title: "Nenhum credenciado com esses filtros",
            text: "Revise a busca ou limpe os filtros para ver a lista completa.",
            action: {id: "clear-providers", label: "Limpar filtros"},
        });
    } else {
        hideEmpty("credenciados");
    }
}

/* =========================================================================
   Tabela de tipos
   ========================================================================= */

// Quantos credenciados usam cada tipo, contados da lista que já chegou.
function providersPerType() {
    const counts = new Map();
    providers.forEach(provider => {
        const key = String(provider.typeId);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
}

function buildTypeRow(type, linked) {
    const row = document.createElement("tr");
    const nameClass = type.isActive ? "table__primary" : "table__primary cred-table__name--inactive";

    row.innerHTML = `
        <td data-label="Tipo"><span class="${nameClass}">${escapeHtml(type.name)}</span></td>
        <td data-label="Credenciados" class="table__num">${linked}</td>
        <td data-label="Situação">${statusBadge(type)}</td>
        ${rowActions(type, "tipo")}
    `;

    return row;
}

function renderTypes() {
    const tbody = document.getElementById("tbodyTypes");
    const count = document.querySelector('[data-table-count="tipos"]');

    const filters = readTypeFilters();
    const filtering = hasActiveFilters(filters);

    document.querySelector('[data-filter-clear="tipos"]').disabled = !filtering;

    const visible = types.filter(type => {
        if (filters.search && !normalize(type.name).includes(filters.search)) return false;
        return matchesStatus(type, filters.status);
    });

    const linked = providersPerType();
    const fragment = document.createDocumentFragment();
    visible.forEach(type => fragment.appendChild(buildTypeRow(type, linked.get(String(type.id)) ?? 0)));
    tbody.replaceChildren(fragment);

    count.textContent = filtering
        ? `${visible.length} de ${plural(types.length, "tipo", "tipos")}`
        : plural(types.length, "tipo cadastrado", "tipos cadastrados");

    if (types.length === 0) {
        showEmpty("tipos", {
            title: "Nenhum tipo de credenciado cadastrado ainda",
            text: "Os tipos classificam os credenciados. Cadastre o primeiro para liberar o cadastro de credenciados.",
            action: {id: "create-type", label: "Cadastrar tipo"},
        });
    } else if (visible.length === 0) {
        showEmpty("tipos", {
            title: "Nenhum tipo com esses filtros",
            text: "Revise a busca ou limpe os filtros para ver a lista completa.",
            action: {id: "clear-types", label: "Limpar filtros"},
        });
    } else {
        hideEmpty("tipos");
    }
}

/* =========================================================================
   Modais

   Abertura e fechamento são do <dialog> nativo: showModal() já prende o foco,
   torna o resto da página inerte e faz o Esc fechar.
   ========================================================================= */

function initModalClosers() {
    document.querySelectorAll("[data-modal-close]").forEach(button => {
        button.addEventListener("click", () => button.closest("dialog")?.close());
    });
}

/* =========================================================================
   Cadastro e edição de credenciado (POST / PUT)
   ========================================================================= */

/**
 * Preenche o select só com os tipos ativos. Na edição de um credenciado cujo
 * tipo foi desativado, esse tipo entra como opção desabilitada e selecionada:
 * o usuário vê qual era, e o envio é barrado até ele escolher outro.
 */
function fillProviderTypeSelect(provider) {
    const select = document.getElementById("credenciado-tipo");
    const hint = document.querySelector("[data-provider-type-hint]");
    const current = provider ? typesById.get(String(provider.typeId)) : null;

    select.innerHTML = `<option value="" disabled>Selecione o tipo</option>`;

    activeTypes().forEach(type => {
        const option = document.createElement("option");
        option.value = String(type.id);
        option.textContent = type.name;
        select.appendChild(option);
    });

    hint.textContent = TYPE_HINT;
    hint.classList.remove("is-warning");

    if (current && !current.isActive) {
        const option = document.createElement("option");
        option.value = String(current.id);
        option.textContent = `${current.name} (desativado)`;
        option.disabled = true;
        select.prepend(option);

        hint.textContent = `O tipo ${current.name} foi desativado. Escolha outro tipo para salvar a edição.`;
        hint.classList.add("is-warning");
    }

    // Com um tipo ativo só, ele já vem escolhido no cadastro: uma escolha que
    // não é escolha não precisa de clique.
    const onlyOne = activeTypes().length === 1 ? String(activeTypes()[0].id) : "";
    select.value = current ? String(current.id) : onlyOne;
}

function openProviderModal(provider) {
    const modal = document.querySelector("[data-provider-modal]");
    const form = document.querySelector("[data-provider-form]");
    const nameInput = document.getElementById("credenciado-nome");

    form.reset();
    clearFieldErrors(PROVIDER_FIELDS);
    clearModalError(form.querySelector("[data-form-error]"));

    // Guardado no formulário para o submit saber se é cadastro ou edição sem
    // depender de qual linha foi clicada por último.
    form.dataset.id = provider ? String(provider.id) : "";

    form.querySelector("[data-modal-title]").textContent = provider ? "Editar credenciado" : "Novo credenciado";
    form.querySelector("[data-modal-subtitle]").textContent = provider
        ? "As alterações valem a partir de agora para este credenciado."
        : "";
    form.querySelector("[data-form-submit]").textContent = provider ? "Salvar alterações" : "Cadastrar credenciado";

    fillProviderTypeSelect(provider);

    if (provider) {
        nameInput.value = provider.name;
        document.getElementById("credenciado-email").value = provider.email ?? "";
    }

    modal.showModal();
    nameInput.focus();
    if (provider) nameInput.select();
}

async function handleProviderSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const submitButton = form.querySelector("[data-form-submit]");
    const errorElement = form.querySelector("[data-form-error]");
    const modal = document.querySelector("[data-provider-modal]");
    const id = form.dataset.id;

    clearFieldErrors(PROVIDER_FIELDS);
    clearModalError(errorElement);

    const emailInput = document.getElementById("credenciado-email");
    const typeSelect = document.getElementById("credenciado-tipo");

    const name = document.getElementById("credenciado-nome").value.trim();
    const email = emailInput.value.trim();
    const typeId = typeSelect.value;
    const selectedType = typesById.get(typeId);

    // Obrigatórios e formato barrados aqui: evita uma ida ao servidor para
    // ouvir de volta o que a tela já sabe. O resto da recusa é do backend.
    const localErrors = {};
    if (!name) localErrors.name = "Informe o nome do credenciado.";
    if (email && emailInput.validity.typeMismatch) localErrors.email = "Informe um e-mail válido.";
    if (!typeId) localErrors.typeId = "Selecione o tipo do credenciado.";
    else if (selectedType && !selectedType.isActive) localErrors.typeId = "Este tipo está desativado. Escolha outro.";

    if (Object.keys(localErrors).length > 0) {
        showFieldErrors(PROVIDER_FIELDS, localErrors)?.focus();
        return;
    }

    submitButton.disabled = true;

    try {
        const result = await apiRequest(id ? `${PROVIDERS_URL}/${id}` : PROVIDERS_URL, {
            method: id ? "PUT" : "POST",
            // E-mail vazio vai como null: o service já trata assim, e a coluna
            // fica sem valor em vez de com texto vazio.
            body: {name, email: email || null, typeId: Number(typeId)},
        });
        if (!result) return;

        if (!result.ok) {
            // Com o modal aberto o toast fica atrás dele, então a recusa vai
            // para o rodapé do painel.
            showModalError(errorElement, messageOf(result, "Não foi possível salvar o credenciado. Tente de novo."));
            showFieldErrors(PROVIDER_FIELDS, fieldsOf(result))?.focus();
            return;
        }

        // Fechar antes de avisar: com o <dialog> na top layer, o toast
        // desenhado embaixo dele passaria despercebido.
        modal.close();
        dismissNotifications();

        const savedName = escapeHtml(result.body?.name ?? name);
        notifySuccess(id ? `${savedName} foi atualizado.` : `${savedName} foi cadastrado.`);

        await loadAll();
    } catch (error) {
        showModalError(errorElement, "Não foi possível conectar ao servidor. Tente de novo.");
        console.error(error);
    } finally {
        submitButton.disabled = false;
    }
}

/* =========================================================================
   Cadastro e edição de tipo (POST / PUT)
   ========================================================================= */

function openTypeModal(type) {
    const modal = document.querySelector("[data-type-modal]");
    const form = document.querySelector("[data-type-form]");
    const input = document.getElementById("tipo-nome");

    form.reset();
    clearFieldErrors(TYPE_FIELDS);
    clearModalError(form.querySelector("[data-form-error]"));

    form.dataset.id = type ? String(type.id) : "";

    form.querySelector("[data-modal-title]").textContent = type ? "Editar tipo de credenciado" : "Novo tipo de credenciado";
    form.querySelector("[data-modal-subtitle]").textContent = type
        ? "O novo nome passa a valer também para os credenciados já vinculados a este tipo."
        : "";
    form.querySelector("[data-form-submit]").textContent = type ? "Salvar alterações" : "Cadastrar tipo";

    if (type) input.value = type.name;

    modal.showModal();
    input.focus();
    if (type) input.select();
}

async function handleTypeSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const submitButton = form.querySelector("[data-form-submit]");
    const errorElement = form.querySelector("[data-form-error]");
    const modal = document.querySelector("[data-type-modal]");
    const id = form.dataset.id;

    clearFieldErrors(TYPE_FIELDS);
    clearModalError(errorElement);

    const name = document.getElementById("tipo-nome").value.trim();

    if (!name) {
        showFieldErrors(TYPE_FIELDS, {name: "Informe o nome do tipo de credenciado."})?.focus();
        return;
    }

    submitButton.disabled = true;

    try {
        const result = await apiRequest(id ? `${TYPES_URL}/${id}` : TYPES_URL, {
            method: id ? "PUT" : "POST",
            body: {name},
        });
        if (!result) return;

        if (!result.ok) {
            // Nome repetido chega como regra de negócio (400 com `fields` vazio).
            showModalError(errorElement, messageOf(result, "Não foi possível salvar o tipo. Tente de novo."));
            showFieldErrors(TYPE_FIELDS, fieldsOf(result))?.focus();
            return;
        }

        modal.close();
        dismissNotifications();

        const savedName = escapeHtml(result.body?.name ?? name);
        notifySuccess(id
            ? `O tipo agora se chama ${savedName}.`
            : `${savedName} já pode ser usado no cadastro de credenciados.`);

        await loadAll();
    } catch (error) {
        showModalError(errorElement, "Não foi possível conectar ao servidor. Tente de novo.");
        console.error(error);
    } finally {
        submitButton.disabled = false;
    }
}

/* =========================================================================
   Situação (PATCH deactivate / reactivate)

   Um modal só para as quatro combinações de credenciado/tipo e
   desativar/reativar; os textos são reescritos a cada abertura.
   ========================================================================= */

function statusWarning(kind, item) {
    if (kind === "provider") {
        return item.isActive
            ? "Ele sai da lista de credenciados ativos, mas o cadastro continua guardado. Dá para reativar depois."
            : "Ele volta para a lista de credenciados ativos.";
    }

    if (!item.isActive) {
        return "Ele volta a aparecer na lista de tipos do cadastro de credenciados.";
    }

    const linked = providers.filter(provider => String(provider.typeId) === String(item.id)).length;
    const consequence = "Ele deixa de aparecer no cadastro de credenciados. Dá para reativar depois.";

    return linked === 0
        ? `${consequence} Nenhum credenciado usa este tipo hoje.`
        : `${consequence} ${plural(linked, "credenciado continua", "credenciados continuam")} vinculado${linked === 1 ? "" : "s"} a ele, mas para editar será preciso escolher outro tipo.`;
}

function openStatusModal(kind, item) {
    const modal = document.querySelector("[data-status-modal]");
    const confirmButton = document.querySelector("[data-status-confirm]");
    const isActive = item.isActive;
    const noun = kind === "provider" ? "credenciado" : "tipo de credenciado";
    const verb = isActive ? "Desativar" : "Reativar";

    clearModalError(document.querySelector("[data-status-error]"));

    document.querySelector("[data-status-title]").textContent = `${verb} ${noun}`;
    document.querySelector("[data-status-question]").textContent =
        `Tem certeza que deseja ${verb.toLowerCase()} este ${noun}?`;

    // textContent, e não innerHTML: o nome vem do cadastro.
    document.querySelector("[data-status-name]").textContent = item.name;
    document.querySelector("[data-status-warning]").textContent = statusWarning(kind, item);

    confirmButton.textContent = kind === "provider" ? `${verb} credenciado` : `${verb} tipo`;
    confirmButton.classList.toggle("btn--danger", isActive);
    confirmButton.classList.toggle("btn--primary", !isActive);

    confirmButton.dataset.kind = kind;
    confirmButton.dataset.id = String(item.id);

    modal.showModal();
    confirmButton.focus();
}

async function handleStatusConfirm(event) {
    const confirmButton = event.currentTarget;
    const errorElement = document.querySelector("[data-status-error]");
    const modal = document.querySelector("[data-status-modal]");

    const {kind, id} = confirmButton.dataset;
    const item = (kind === "provider" ? providersById : typesById).get(id);
    if (!item) return;

    // A situação alvo é o inverso da atual — é o mesmo botão para os dois lados.
    const target = !item.isActive;
    const baseUrl = kind === "provider" ? PROVIDERS_URL : TYPES_URL;

    clearModalError(errorElement);
    confirmButton.disabled = true;

    try {
        const result = await apiRequest(`${baseUrl}/${id}/${target ? "reactivate" : "deactivate"}`, {method: "PATCH"});
        if (!result) return;

        if (!result.ok) {
            showModalError(errorElement, messageOf(result, "Não foi possível mudar a situação. Tente de novo."));
            return;
        }

        modal.close();
        dismissNotifications();

        const name = escapeHtml(item.name);
        notifySuccess(target ? `${name} foi reativado.` : `${name} foi desativado.`);

        await loadAll();
    } catch (error) {
        showModalError(errorElement, "Não foi possível conectar ao servidor. Tente de novo.");
        console.error(error);
    } finally {
        confirmButton.disabled = false;
    }
}

/* =========================================================================
   Ações da linha

   Um listener só por <tbody>: as linhas são redesenhadas a cada filtro e a
   cada recarga.
   ========================================================================= */

function bindRowActions(tbodyId, kind, map, openEdit) {
    document.getElementById(tbodyId).addEventListener("click", event => {
        const editButton = event.target.closest("[data-edit]");
        if (editButton) {
            const item = map.get(editButton.dataset.edit);
            if (item) openEdit(item);
            return;
        }

        const statusButton = event.target.closest("[data-status]");
        if (statusButton) {
            const item = map.get(statusButton.dataset.status);
            if (item) openStatusModal(kind, item);
        }
    });
}

/* =========================================================================
   Ligação
   ========================================================================= */

function init() {
    if (!document.querySelector("[data-tabs]")) return;

    initTabs();
    initFilters();
    initEmptyActions();
    initModalClosers();

    document.querySelector("[data-create-provider]").addEventListener("click", () => openProviderModal(null));
    document.querySelector("[data-create-type]").addEventListener("click", () => openTypeModal(null));

    document.querySelector("[data-provider-form]").addEventListener("submit", handleProviderSubmit);
    document.querySelector("[data-type-form]").addEventListener("submit", handleTypeSubmit);
    document.querySelector("[data-status-confirm]").addEventListener("click", handleStatusConfirm);

    bindRowActions("tbodyProviders", "provider", providersById, openProviderModal);
    bindRowActions("tbodyTypes", "type", typesById, openTypeModal);

    loadAll();
}

// Rodar tudo
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init(); // DOM já está pronto para rodar
}
