/**
 * Lançamento de curso: preenche a select de cooperados e envia o formulário.
 *
 * Contrato com o HTML (data-*):
 *   [data-course-form]  formulário, submit interceptado
 *
 * Por id: curso-cooperado/erro-cooperado, curso-titulo/erro-titulo,
 * curso-horas + curso-minutos/erro-carga, curso-conclusao/erro-conclusao,
 * curso-cooperativismo-sim + -nao/erro-cooperativismo,
 * curso-certificado/erro-certificado e curso-observacoes/erro-observacoes.
 *
 * O envio é multipart: o backend recebe os campos do curso por @ModelAttribute e
 * o arquivo por @RequestPart("certificate"), e grava os dois juntos ou nenhum.
 *
 * Carga horária: a tela pergunta horas e minutos separados porque é assim que o
 * certificado costuma trazer, mas o banco guarda um número só (total_minutes).
 * A conversão acontece aqui, no envio.
 *
 * O retorno de sucesso e de erro sai em toast (ver utils/notyf.js); o que é
 * específico de um campo continua no <p class="field__error"> dele.
 */

import {dismissNotifications, notifyError, notifySuccess} from "../utils/notyf.js";

const COURSES_URL = "/certificados-cooperados/api/v1/courses";
const ACTIVE_MEMBERS_URL = "/certificados-cooperados/api/v1/cooperative-members?active=true";

// Liga o campo que o backend devolve em `fields` aos elementos da tela. A carga
// horária são dois inputs para um campo só, e o cooperativismo são dois rádios:
// nos dois casos o erro aparece no bloco do fieldset e o foco vai para o
// primeiro controle do grupo.
const FIELDS = {
    cooperativeMemberId: {inputId: "curso-cooperado", errorId: "erro-cooperado"},
    title: {inputId: "curso-titulo", errorId: "erro-titulo"},
    totalMinutes: {inputId: "curso-horas", errorId: "erro-carga"},
    completionDate: {inputId: "curso-conclusao", errorId: "erro-conclusao"},
    isCooperativism: {inputId: "curso-cooperativismo-sim", errorId: "erro-cooperativismo"},
    observations: {inputId: "curso-observacoes", errorId: "erro-observacoes"},
    certificate: {inputId: "curso-certificado", errorId: "erro-certificado"},
};

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

function showFieldError(field, message) {
    const target = FIELDS[field];
    if (!target) return null;

    const input = document.getElementById(target.inputId);
    const errorElement = document.getElementById(target.errorId);

    input.setAttribute("aria-invalid", "true");
    errorElement.textContent = message;
    errorElement.classList.remove("is-hidden");

    return input;
}

// Recebe o mapa `fields` do ApiError e devolve o primeiro campo marcado, para
// levar o foco até ele.
function showFieldErrors(fields) {
    let firstInvalid = null;

    Object.entries(fields).forEach(([field, message]) => {
        const input = showFieldError(field, message);
        if (input && !firstInvalid) firstInvalid = input;
    });

    return firstInvalid;
}

/* =========================================================================
   Select de cooperados
   ========================================================================= */

async function populateMembersSelect() {
    const select = document.getElementById("curso-cooperado");

    try {
        const response = await fetch(ACTIVE_MEMBERS_URL, {credentials: "same-origin"});

        if (response.status === 401) {
            window.location.href = "login";
            return;
        }

        if (!response.ok) {
            throw new Error(`A API respondeu ${response.status}`);
        }

        const responseJSON = await response.json();
        const members = Array.isArray(responseJSON) ? responseJSON : [];

        // Sem cooperado ativo não há o que lançar; melhor dizer isso na própria
        // select do que deixar uma lista vazia sem explicação.
        if (!members.length) {
            select.querySelector("option").textContent = "Nenhum cooperado ativo cadastrado";
            notifyError("Cadastre um cooperado antes de lançar um curso.");
            return;
        }

        const fragment = document.createDocumentFragment();

        members.forEach(member => {
            const option = document.createElement("option");
            option.value = member.id;
            // textContent, e não innerHTML: o nome vem do cadastro.
            option.textContent = member.name;
            fragment.appendChild(option);
        });

        select.appendChild(fragment);
    } catch (error) {
        select.querySelector("option").textContent = "Não foi possível carregar os cooperados";

        notifyError("Não foi possível carregar a lista de cooperados. Atualize a página.");
        console.error(error);
    }
}

/* =========================================================================
   Carga horária
   ========================================================================= */

// Campo vazio conta como zero: o de minutos é opcional e o total é validado
// logo em seguida.
function readNumber(id) {
    const value = Number.parseInt(document.getElementById(id).value, 10);
    return Number.isNaN(value) ? 0 : value;
}

/** Horas e minutos da tela viram o total_minutes que o banco guarda. */
function readTotalMinutes() {
    return readNumber("curso-horas") * 60 + readNumber("curso-minutos");
}

/* =========================================================================
   Envio (POST multipart)
   ========================================================================= */

function buildFormData(totalMinutes) {
    const formData = new FormData();

    formData.append("cooperativeMemberId", document.getElementById("curso-cooperado").value);
    formData.append("title", document.getElementById("curso-titulo").value.trim());
    formData.append("totalMinutes", totalMinutes);
    formData.append("completionDate", document.getElementById("curso-conclusao").value);
    formData.append("certificate", document.getElementById("curso-certificado").files[0]);

    // Grupo sem nenhum rádio marcado não entra no envio: o campo chega null no
    // backend e o @NotNull responde com a mensagem escrita para o usuário. Um
    // append incondicional mandaria a string "undefined", que falha na conversão
    // e viraria o texto genérico de valor inválido.
    const cooperativism = document.querySelector('input[name="isCooperativism"]:checked');
    if (cooperativism) formData.append("isCooperativism", cooperativism.value);

    // Campo opcional: em branco não vai no envio, para o backend gravar null em
    // vez de string vazia.
    const observations = document.getElementById("curso-observacoes").value.trim();
    if (observations) formData.append("observations", observations);

    return formData;
}

// Traduz o ApiError da recusa em mensagens na tela. O corpo é sempre
// {message, fields}: `fields` vem preenchido na validação das anotações e vazio
// quando é regra de negócio (cooperado inativo, arquivo fora do padrão).
function handleErrorResponse(apiError) {
    const message = apiError?.message || "Não foi possível lançar o curso. Tente de novo.";
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

    // 2h e 0min é válido, 0h e 30min também; 0 e 0 não. O `required` do HTML não
    // cobre isso, porque zero é um valor preenchido.
    const totalMinutes = readTotalMinutes();

    if (totalMinutes <= 0) {
        const input = showFieldError("totalMinutes", "A carga horária precisa ser maior que zero.");
        notifyError("Informe a carga horária do curso.");
        input?.focus();
        return;
    }

    submitButton.disabled = true;

    try {
        // Sem Content-Type manual: o navegador precisa gerar o boundary do
        // multipart, e defini-lo à mão quebra a leitura do arquivo no servidor.
        const response = await fetch(COURSES_URL, {
            method: "POST",
            credentials: "same-origin",
            body: buildFormData(totalMinutes),
        });

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
        form.reset();
        notifySuccess(`Curso lançado para ${body?.cooperativeMemberName ?? "o cooperado"}.`);
    } catch (error) {
        notifyError("Não foi possível conectar ao servidor. Tente de novo.");
        console.error(error);
    } finally {
        submitButton.disabled = false;
    }
}

/* =========================================================================
   Ligação
   ========================================================================= */

function initCourseForm() {
    const form = document.querySelector("[data-course-form]");
    if (!form) return;

    form.addEventListener("submit", handleSubmit);

    // "Limpar campos" também zera o que sobrou do envio anterior.
    form.addEventListener("reset", () => {
        dismissNotifications();
        clearFieldErrors();
    });

    // Data futura é recusada pelo backend (@PastOrPresent); bloquear no seletor
    // evita que o usuário escolha uma para só depois descobrir.
    document.getElementById("curso-conclusao").max = new Date().toLocaleDateString("en-CA");
}

function init() {
    initCourseForm();
    populateMembersSelect();
}

// Rodar tudo
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init(); // DOM já está pronto para rodar
}
