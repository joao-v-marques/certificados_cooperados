/**
 * Encerramento de sessão.
 *
 * Contrato com o HTML:
 *   [data-logout]  botão que dispara a saída; pode haver mais de um na página
 *
 * O trabalho é do servidor: o cookie access_token é httpOnly, então não há como
 * apagá-lo daqui — o POST é que devolve o Set-Cookie vencido. Só depois da
 * resposta a página vai para o login; redirecionar antes deixaria o usuário na
 * tela de login ainda autenticado, e a primeira navegação o traria de volta.
 */

import {notifyError} from "../utils/notyf.js";

const LOGOUT_URL = "/certificados-cooperados/api/v1/auth/logout";
const LOGIN_PAGE = "/certificados-cooperados/login";

async function handleLogout(event) {
    const button = event.currentTarget;

    // Dois cliques seguidos dispariam dois POSTs e uma corrida de redirecionamento.
    button.disabled = true;

    try {
        const response = await fetch(LOGOUT_URL, {
            method: "POST",
            credentials: "same-origin",
        });

        if (!response.ok) {
            throw new Error(`A API respondeu ${response.status}`);
        }

        // replace, e não href: o botão "voltar" não deve trazer de volta uma
        // página da aplicação que a sessão encerrada não abre mais.
        window.location.replace(LOGIN_PAGE);
    } catch (error) {
        // Sem redirecionar: se o cookie não foi apagado, a sessão continua aberta,
        // e mandar para o login faria parecer que saiu. Melhor dizer que falhou.
        notifyError("Não foi possível encerrar a sessão. Tente de novo.");
        console.error(error);

        button.disabled = false;
    }
}

export function initLogout() {
    document.querySelectorAll("[data-logout]")
        .forEach(button => button.addEventListener("click", handleLogout));
}
