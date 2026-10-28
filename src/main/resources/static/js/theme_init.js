/**
 * Aplica o tema antes da primeira pintura.
 *
 * Script clássico, e não módulo, carregado no <head> antes das folhas de
 * estilo: módulo é adiado até o fim do parse, e a página piscaria clara antes
 * de escurecer. Por isso também não importa nada — a lógica de troca mora em
 * utils/theme.js, que lê a mesma chave.
 *
 * Ordem de decisão: a escolha guardada pelo usuário no menu da conta; sem ela,
 * a preferência do sistema operacional.
 */
(function () {
    var STORAGE_KEY = "ui.theme";
    var theme = null;

    // Storage pode estar bloqueado (navegação privada); aí vale o sistema.
    try {
        var stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored === "light" || stored === "dark") theme = stored;
    } catch (error) {
        /* segue sem preferência guardada */
    }

    if (!theme) {
        var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        theme = prefersDark ? "dark" : "light";
    }

    document.documentElement.setAttribute("data-theme", theme);
})();
