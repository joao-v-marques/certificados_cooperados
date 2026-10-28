/**
 * Tema claro/escuro: leitura, troca e o interruptor do menu da conta.
 *
 * O tema inicial já foi aplicado por js/theme_init.js antes da pintura; aqui
 * fica só o que acontece depois. A chave do storage é a mesma dos dois lados.
 *
 * Contrato com o HTML (data-*):
 *   [data-theme-toggle]  botão role="switch"; aria-checked="true" no escuro
 */

const STORAGE_KEY = "ui.theme";

const root = document.documentElement;

const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)");

export const currentTheme = () => (root.dataset.theme === "dark" ? "dark" : "light");

function storedTheme() {
    try {
        const value = window.localStorage.getItem(STORAGE_KEY);
        return value === "light" || value === "dark" ? value : null;
    } catch {
        return null;
    }
}

function applyTheme(theme) {
    // Um quadro sem transição: sem isto, cada componente animaria a própria
    // cor num ritmo diferente e a troca pareceria uma onda pela tela.
    root.classList.add("theme-switching");
    root.dataset.theme = theme;

    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => root.classList.remove("theme-switching"));
    });

    syncToggles();
}

/** Troca o tema e guarda a escolha, que passa a valer acima da do sistema. */
export function setTheme(theme) {
    applyTheme(theme);

    try {
        window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
        /* segue sem persistir */
    }
}

function syncToggles() {
    const isDark = currentTheme() === "dark";

    document.querySelectorAll("[data-theme-toggle]").forEach(toggle => {
        toggle.setAttribute("aria-checked", String(isDark));
    });
}

export function initThemeToggle() {
    syncToggles();

    document.querySelectorAll("[data-theme-toggle]").forEach(toggle => {
        // O menu continua aberto de propósito: dá para ver a tela mudar e
        // voltar atrás sem reabrir. O shell já ignora clique dentro do
        // dropdown no "clique fora", então não há o que barrar aqui.
        toggle.addEventListener("click", () => {
            setTheme(currentTheme() === "dark" ? "light" : "dark");
        });
    });

    // Enquanto o usuário não escolheu, a tela acompanha o sistema ao vivo —
    // quem tem o modo escuro programado para a noite vê a troca acontecer.
    systemDark?.addEventListener("change", event => {
        if (storedTheme()) return;
        applyTheme(event.matches ? "dark" : "light");
    });
}
