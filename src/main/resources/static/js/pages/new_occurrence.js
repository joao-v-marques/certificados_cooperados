/**
 * Lançamento de ocorrência: preenche as selects de solicitante e de tipo e
 * envia o formulário.
 *
 * O solicitante é um cooperado (Relac. Cooperado) ou um credenciado da rede
 * (Relac. Rede) — nunca os dois, regra que o backend também cobra. Só o campo
 * do lado escolhido fica visível e habilitado, e só ele vai no corpo; o outro
 * id segue como null.
 *
 * Contrato com o HTML (data-*):
 *   [data-occurrence-form]                formulário, submit interceptado
 *   [data-requester-switch]               radios name="requesterKind" (cooperado | rede)
 *   [data-requester-field="<lado>"]       campo de cada lado, alternado pelo switch
 *   [data-responsibility-modal]           aviso de responsabilidade, aberto na carga
 *   [data-responsibility-accept]          botão "Eu concordo", única saída do aviso
 *
 * Por id: ocorrencia-cooperado/erro-cooperado,
 * ocorrencia-credenciado/erro-credenciado, ocorrencia-tipo/erro-tipo,
 * ocorrencia-data/erro-data e ocorrencia-observacoes/erro-observacoes.
 *
 * O envio é JSON, e não multipart como no lançamento de curso: ocorrência não
 * tem anexo, então o backend recebe por @RequestBody.
 *
 * O retorno de sucesso e de erro sai em toast (ver utils/notyf.js); o que é
 * específico de um campo continua no <p class="field__error"> dele.
 */

import {dismissNotifications, notifyError, notifySuccess} from "../utils/notyf.js";

const OCCURRENCES_URL = "/certificados-cooperados/api/v1/occurrences";
const OCCURRENCE_TYPES_URL = "/certificados-cooperados/api/v1/occurrence-types";
const ACTIVE_MEMBERS_URL = "/certificados-cooperados/api/v1/cooperative-members?active=true";

// Esta lista traz ativos e inativos; o filtro dos ativos é feito aqui.
const PROVIDERS_URL = "/certificados-cooperados/api/v1/credentialed-providers";

// Liga o campo que o backend devolve em `fields` aos elementos da tela.
const FIELDS = {
    cooperativeMemberId: {inputId: "ocorrencia-cooperado", errorId: "erro-cooperado"},
    credentialedProviderId: {inputId: "ocorrencia-credenciado", errorId: "erro-credenciado"},
    occurrenceTypeId: {inputId: "ocorrencia-tipo", errorId: "erro-tipo"},
    occurrenceDate: {inputId: "ocorrencia-data", errorId: "erro-data"},
    observations: {inputId: "ocorrencia-observacoes", errorId: "erro-observacoes"},
};

/* =========================================================================
   Texto vindo do banco
   ========================================================================= */

// O nome do solicitante volta da API e vai para o toast, que o Notyf grava
// com innerHTML; não pode ser interpolado cru.
function escapeHtml(value) {
    const characters = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"};
    return String(value ?? "").replace(/[&<>"']/g, character => characters[character]);
}

/* =========================================================================
   Erros de campo
   ========================================================================= */

function clearFieldErrors() {
    Object.values(FIELDS).forEach(({inputId, errorId}) => {
        const errorElement = document.getElementById(errorId);

        document.getElementById(inputId).removeAttribute("aria-invalid");
        errorElement.textContent = "";
        errorElement.classList.add("is-hidden");
    });
}

// Recebe o mapa `fields` do ApiError e devolve o primeiro campo marcado, para
// levar o foco até ele.
function showFieldErrors(fields) {
    let firstInvalid = null;

    Object.entries(fields).forEach(([field, message]) => {
        const target = FIELDS[field];
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

/* =========================================================================
   Selects

   As duas seguem a mesma forma: buscam a lista, viram <option> e avisam na
   própria select quando não há o que oferecer — lista vazia sem explicação
   deixa o usuário sem saber se falta cadastro ou se a tela quebrou.
   ========================================================================= */

// `prepare` recebe a lista da API e devolve só o que vira opção, já no formato
// {id, label} — é por ele que os credenciados são filtrados e ganham o tipo
// no rótulo. Sem ele, cada item vira {id, name}.
async function populateSelect({selectId, url, prepare, emptyLabel, emptyToast, errorLabel, errorToast}) {
    const select = document.getElementById(selectId);

    try {
        const response = await fetch(url, {credentials: "same-origin"});

        if (response.status === 401) {
            window.location.href = "login";
            return;
        }

        if (!response.ok) {
            throw new Error(`A API respondeu ${response.status}`);
        }

        const responseJSON = await response.json();
        const list = Array.isArray(responseJSON) ? responseJSON : [];
        const items = prepare ? prepare(list) : list.map(item => ({id: item.id, label: item.name}));

        if (!items.length) {
            select.querySelector("option").textContent = emptyLabel;
            notifyError(emptyToast);
            return;
        }

        const fragment = document.createDocumentFragment();

        items.forEach(item => {
            const option = document.createElement("option");
            option.value = item.id;
            // textContent, e não innerHTML: o nome vem do banco.
            option.textContent = item.label;
            fragment.appendChild(option);
        });

        select.appendChild(fragment);
    } catch (error) {
        select.querySelector("option").textContent = errorLabel;

        notifyError(errorToast);
        console.error(error);
    }
}

const populateMembersSelect = () => populateSelect({
    selectId: "ocorrencia-cooperado",
    url: ACTIVE_MEMBERS_URL,
    emptyLabel: "Nenhum cooperado ativo cadastrado",
    emptyToast: "Cadastre um cooperado antes de lançar uma ocorrência.",
    errorLabel: "Não foi possível carregar os cooperados",
    errorToast: "Não foi possível carregar a lista de cooperados. Atualize a página.",
});

// O tipo entra no rótulo para diferenciar homônimos e ajudar a achar o
// credenciado certo numa lista longa.
const populateProvidersSelect = () => populateSelect({
    selectId: "ocorrencia-credenciado",
    url: PROVIDERS_URL,
    prepare: list => list
        .filter(provider => provider.isActive)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
        .map(provider => ({id: provider.id, label: `${provider.name} (${provider.typeName})`})),
    emptyLabel: "Nenhum credenciado ativo cadastrado",
    emptyToast: "Cadastre um credenciado antes de lançar uma ocorrência da rede.",
    errorLabel: "Não foi possível carregar os credenciados",
    errorToast: "Não foi possível carregar a lista de credenciados. Atualize a página.",
});

const populateTypesSelect = () => populateSelect({
    selectId: "ocorrencia-tipo",
    url: OCCURRENCE_TYPES_URL,
    emptyLabel: "Nenhum tipo de ocorrência disponível",
    emptyToast: "Nenhum tipo de ocorrência está ativo. Procure o administrador.",
    errorLabel: "Não foi possível carregar os tipos",
    errorToast: "Não foi possível carregar os tipos de ocorrência. Atualize a página.",
});

/* =========================================================================
   Relacionamento (solicitante)
   ========================================================================= */

function currentRequesterKind() {
    return document.querySelector('[data-requester-switch] input:checked')?.value ?? "cooperado";
}

// A lista de credenciados só é buscada na primeira vez que "Relac. Rede" é
// escolhido: quem lança só ocorrência de cooperado não precisa da chamada, nem
// de um toast de "nenhum credenciado" que não é problema dele.
let providersRequested = false;

/**
 * Mostra o campo do lado escolhido e esconde o outro. O escondido também fica
 * disabled: assim o `required` dele não barra o envio e o valor não vaza para
 * o formulário.
 */
function syncRequesterFields() {
    const kind = currentRequesterKind();

    document.querySelectorAll("[data-requester-field]").forEach(field => {
        const active = field.dataset.requesterField === kind;
        field.hidden = !active;
        field.querySelector("select").disabled = !active;
    });

    if (kind === "rede" && !providersRequested) {
        providersRequested = true;
        populateProvidersSelect();
    }
}

function initRequesterSwitch() {
    const requesterSwitch = document.querySelector("[data-requester-switch]");
    if (!requesterSwitch) return;

    requesterSwitch.addEventListener("change", () => {
        // O erro do lado que saiu de vista não deve reaparecer quando ele voltar.
        clearFieldErrors();
        syncRequesterFields();
    });

    syncRequesterFields();
}

/* =========================================================================
   Envio (POST em JSON)
   ========================================================================= */

// Select vazia vira null, e não 0: Number("") daria zero, que é um id válido
// para o binder e faria o backend procurar um registro em vez de responder o
// @NotNull escrito para o usuário.
function readId(elementId) {
    const value = document.getElementById(elementId).value;
    return value ? Number(value) : null;
}

function readForm() {
    const kind = currentRequesterKind();

    return {
        occurrenceTypeId: readId("ocorrencia-tipo"),
        // Só o lado escolhido vai preenchido: o backend recusa os dois juntos.
        cooperativeMemberId: kind === "cooperado" ? readId("ocorrencia-cooperado") : null,
        credentialedProviderId: kind === "rede" ? readId("ocorrencia-credenciado") : null,
        occurrenceDate: document.getElementById("ocorrencia-data").value || null,
        observations: document.getElementById("ocorrencia-observacoes").value.trim(),
    };
}

async function postOccurrence(payload) {
    return fetch(OCCURRENCES_URL, {
        method: "POST",
        credentials: "same-origin",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
    });
}

// Traduz o ApiError da recusa em mensagens na tela. O corpo é sempre
// {message, fields}: `fields` vem preenchido na validação das anotações e vazio
// quando é regra de negócio (cooperado inativo, tipo desativado).
function handleErrorResponse(apiError) {
    const message = apiError?.message || "Não foi possível lançar a ocorrência. Tente de novo.";
    const fields = apiError?.fields ?? {};

    notifyError(message);

    const firstInvalid = showFieldErrors(fields);
    if (firstInvalid) firstInvalid.focus();
}

async function handleSubmit(event) {
    event.preventDefault();

    // Os toasts do envio anterior saem da tela: o que vale é o resultado deste.
    dismissNotifications();
    clearFieldErrors();

    // Guardado agora: depois do primeiro await o event.currentTarget já é null,
    // porque o disparo do evento terminou.
    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
        const response = await postOccurrence(readForm());

        // Sessão expirada no meio do lançamento: o entryPoint responde 401 e a
        // página de login mostra o aviso.
        if (response.status === 401) {
            window.location.href = "login";
            return;
        }

        const body = await response.json().catch(() => null);

        if (!response.ok) {
            handleErrorResponse(body);
            return;
        }

        // Limpar antes de avisar: reset() dispara o evento de reset, que derruba
        // os toasts — na ordem inversa o sucesso apareceria e sumiria na hora.
        //
        // O relacionamento escolhido sobrevive ao reset: quem está lançando
        // ocorrências da rede costuma lançar várias seguidas.
        const kind = currentRequesterKind();
        form.reset();
        form.querySelector(`[data-requester-switch] input[value="${kind}"]`).checked = true;
        syncRequesterFields();

        const requesterName = body?.cooperativeMemberName ?? body?.credentialedProviderName ?? "o solicitante";
        notifySuccess(`Ocorrência lançada para ${escapeHtml(requesterName)}.`);
    } catch (error) {
        notifyError("Não foi possível conectar ao servidor. Tente de novo.");
        console.error(error);
    } finally {
        submitButton.disabled = false;
    }
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

function initOccurrenceForm() {
    const form = document.querySelector("[data-occurrence-form]");
    if (!form) return;

    form.addEventListener("submit", handleSubmit);

    // "Limpar campos" também zera o que sobrou do envio anterior.
    form.addEventListener("reset", () => {
        dismissNotifications();
        clearFieldErrors();

        // O evento sai antes de os valores voltarem ao padrão; o radio só está
        // de volta em "Relac. Cooperado" na próxima volta do laço de eventos.
        setTimeout(syncRequesterFields);
    });

    // Data futura é recusada pelo backend (@PastOrPresent); bloquear no seletor
    // evita que o usuário escolha uma para só depois descobrir.
    document.getElementById("ocorrencia-data").max = new Date().toLocaleDateString("en-CA");
}

function init() {
    initResponsibilityNotice();
    initOccurrenceForm();
    initRequesterSwitch();
    populateMembersSelect();
    populateTypesSelect();
}

// Rodar tudo
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init(); // DOM já está pronto para rodar
}
