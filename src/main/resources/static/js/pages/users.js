/**
 * Usuários: por enquanto, só o comportamento de tela.
 *
 * A ligação com a API ainda não existe. O que falta, quando ela entrar:
 *   - GET  dos usuários para preencher #tbodyUsers e #cardUsersQtd, revelando
 *     [data-empty-state] só quando a API confirmar que a lista veio vazia;
 *   - POST de [data-user-form], com o submit interceptado, o retorno em toast
 *     (js/utils/notyf.js) e o erro de campo no <p class="field__error">;
 *   - conferir senha e confirmação antes de enviar — o campo de confirmação é
 *     só da tela e não vai para o servidor.
 *
 * O modelo dos dois primeiros é o cooperative_members.js, que já faz isso.
 */

import {initPasswordToggles} from '../utils/password_toggle.js';

initPasswordToggles();
