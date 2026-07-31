import { initLogout } from '../auth/logout.js';

/** Espelha o breakpoint do CSS: abaixo disso a sidebar vira overlay. */
const BREAKPOINT_OVERLAY = 1024;
const STORAGE_KEY = 'ui.sidebar.collapsed';

const isOverlayMode = () => window.innerWidth < BREAKPOINT_OVERLAY;

const app = document.querySelector('[data-app]');

/* =========================================================================
   Sidebar
   Desktop: recolhe para a faixa de ícones, e a preferência fica guardada.
   Mobile:  abre em overlay, com fundo escuro clicável.
   ========================================================================= */

function initSidebar() {
  if (!app) return null;

  const sidebar = document.querySelector('[data-sidebar]');
  const scrim = document.querySelector('[data-sidebar-scrim]');
  const toggle = document.querySelector('[data-sidebar-toggle]');

  const isOpen = () => app.classList.contains('is-sidebar-open');

  function open() {
    app.classList.add('is-sidebar-open');
    if (scrim) scrim.hidden = false;
    toggle?.setAttribute('aria-expanded', 'true');
  }

  function close({ returnFocus = false } = {}) {
    app.classList.remove('is-sidebar-open');
    if (scrim) scrim.hidden = true;
    toggle?.setAttribute('aria-expanded', 'false');
    if (returnFocus) toggle?.focus();
  }

  function toggleCollapsed() {
    const collapsed = app.classList.toggle('is-collapsed');
    toggle?.setAttribute('aria-expanded', String(!collapsed));
    // Storage pode estar bloqueado (navegação privada); a preferência
    // simplesmente não persiste, e nada quebra.
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      /* segue sem persistir */
    }
  }

  function restoreCollapsed() {
    let stored = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }

    if (stored === '1') {
      app.classList.add('is-collapsed');
      toggle?.setAttribute('aria-expanded', 'false');
    } else if (!isOverlayMode()) {
      toggle?.setAttribute('aria-expanded', 'true');
    }
  }

  toggle?.addEventListener('click', () => {
    if (!isOverlayMode()) {
      toggleCollapsed();
      return;
    }
    if (isOpen()) close();
    else open();
  });

  scrim?.addEventListener('click', () => close({ returnFocus: true }));

  // Navegar para outra tela fecha o overlay antes da troca de página.
  sidebar?.addEventListener('click', (event) => {
    if (event.target.closest('a') && isOverlayMode()) close();
  });

  // Voltar para o desktop não pode deixar o overlay pendurado.
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (!isOverlayMode()) close();
    }, 120);
  });

  restoreCollapsed();
  return { isOpen, close };
}

/* =========================================================================
   Dropdown da conta

   Contrato no HTML:
     [data-dropdown]
       [data-dropdown-trigger]  botão com aria-expanded
       [data-dropdown-menu]     painel controlado pelo atributo hidden
   ========================================================================= */

function initDropdowns() {
  const dropdowns = [...document.querySelectorAll('[data-dropdown]')]
    .map((root) => {
      const trigger = root.querySelector('[data-dropdown-trigger]');
      const menu = root.querySelector('[data-dropdown-menu]');
      if (!trigger || !menu) return null;

      const isOpen = () => !menu.hidden;

      function open() {
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        menu.querySelector('a, button')?.focus();
      }

      function close({ returnFocus = false } = {}) {
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        if (returnFocus) trigger.focus();
      }

      return { root, trigger, menu, isOpen, open, close };
    })
    .filter(Boolean);

  if (!dropdowns.length) return dropdowns;

  const closeAll = (except) => {
    dropdowns.forEach((item) => {
      if (item !== except && item.isOpen()) item.close();
    });
  };

  dropdowns.forEach((dropdown) => {
    dropdown.trigger.addEventListener('click', () => {
      if (dropdown.isOpen()) {
        dropdown.close();
        return;
      }
      closeAll(dropdown);
      dropdown.open();
    });

    // Seta para baixo no gatilho abre e já entra no menu.
    dropdown.trigger.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowDown' || dropdown.isOpen()) return;
      event.preventDefault();
      dropdown.trigger.click();
    });

    // Tab para fora fecha: menu aberto sem foco dentro é armadilha de teclado.
    dropdown.menu.addEventListener('focusout', () => {
      window.setTimeout(() => {
        if (!dropdown.root.contains(document.activeElement)) dropdown.close();
      }, 0);
    });
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-dropdown]')) return;
    closeAll(null);
  });

  return dropdowns;
}

/* =========================================================================
   Usuário autenticado

   Contrato no HTML (presente na topbar de toda página):
     [data-user-initials]  iniciais do avatar
     [data-user-name]      nome; aparece duas vezes (gatilho e menu aberto)
     [data-user-email]     e-mail, dentro do menu

   Fica no shell porque a topbar é a mesma em todas as telas — cada página
   preencher a sua repetiria a chamada e o contrato.
   ========================================================================= */

const CURRENT_USER_URL = '/certificados-cooperados/api/v1/users/me';

async function initCurrentUser() {
  const nameTargets = document.querySelectorAll('[data-user-name]');
  const initialsTarget = document.querySelector('[data-user-initials]');
  const emailTarget = document.querySelector('[data-user-email]');

  // Tela sem topbar (login) não tem nada a preencher.
  if (!nameTargets.length && !initialsTarget && !emailTarget) return;

  try {
    const response = await fetch(CURRENT_USER_URL, { credentials: 'same-origin' });

    if (!response.ok) throw new Error(`A API respondeu ${response.status}`);

    const user = await response.json();

    // textContent, e não innerHTML: nome e e-mail vêm do cadastro e não podem
    // ser interpretados como marcação.
    nameTargets.forEach((target) => {
      target.textContent = user.name;
    });

    if (initialsTarget) initialsTarget.textContent = user.initials;
    // O e-mail é opcional no cadastro; sem ele a linha fica vazia.
    if (emailTarget) emailTarget.textContent = user.email ?? '';
  } catch (error) {
    // Sem toast de propósito: o shell roda em toda página, e uma falha aqui
    // viraria ruído em cada navegação. O rótulo cai para algo neutro em vez de
    // ficar preso em "Carregando..." ou de inventar um nome.
    nameTargets.forEach((target) => {
      target.textContent = 'Conta';
    });

    if (initialsTarget) initialsTarget.textContent = '';

    console.error(error);
  }
}

/* =========================================================================
   Ligação
   ========================================================================= */

const sidebar = initSidebar();
const dropdowns = initDropdowns();

initCurrentUser();
initLogout();

// Esc fecha a camada mais alta: o dropdown antes da sidebar, para que fechar
// o menu da conta não feche junto a navegação em overlay.
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;

  const openDropdown = dropdowns.find((dropdown) => dropdown.isOpen());
  if (openDropdown) {
    openDropdown.close({ returnFocus: true });
    return;
  }

  if (sidebar?.isOpen()) sidebar.close({ returnFocus: true });
});
