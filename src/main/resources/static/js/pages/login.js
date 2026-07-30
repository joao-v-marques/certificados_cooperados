document.querySelectorAll('[data-password-toggle]').forEach((toggle) => {
    const field = document.getElementById(toggle.getAttribute('aria-controls'));
    if (!field) return;

    const iconShow = toggle.querySelector('.icon-eye');
    const iconHide = toggle.querySelector('.icon-eye-off');
    const label = toggle.querySelector('[data-password-toggle-label]');

    toggle.addEventListener('click', () => {
        const willShow = field.type === 'password';

        field.type = willShow ? 'text' : 'password';
        toggle.setAttribute('aria-pressed', String(willShow));

        iconShow?.classList.toggle('is-hidden', willShow);
        iconHide?.classList.toggle('is-hidden', !willShow);
        if (label) label.textContent = willShow ? 'Ocultar a senha' : 'Mostrar a senha';

        // O cursor volta para o campo, no fim do que já foi digitado.
        const end = field.value.length;
        field.focus();
        try {
            field.setSelectionRange(end, end);
        } catch {
            // alguns navegadores recusam setSelectionRange em type="password"
        }
    });
});

const formLogin = document.querySelector('.login__form');
const alertBox = document.querySelector('.login__alert');
const alertTitle = alertBox?.querySelector('.alert__title');
const alertMessage = alertBox?.querySelector('.alert__content p:not(.alert__title)');
const submitButton = formLogin?.querySelector('button[type="submit"]');

function showError(message) {
    // O título pode ter vindo do servidor ("Faça login para continuar", "Sua
    // sessão expirou"); a partir daqui o assunto é a tentativa de login.
    if (alertTitle) alertTitle.textContent = 'Não foi possível entrar';
    if (alertMessage) alertMessage.textContent = message;
    if (alertBox) alertBox.hidden = false;
}

formLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (alertBox) alertBox.hidden = true;
    if (submitButton) submitButton.disabled = true;

    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch('api/v1/auth/login', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, password}),
        });

        if (!response.ok) {
            const error = await response.json();
            showError(error.message || 'Não foi possível entrar. Tente novamente.');
            return;
        }

        window.location.href = 'home';
    } catch {
        showError('Não foi possível conectar ao servidor. Tente novamente.');
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
})