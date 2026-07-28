/**
 * home.js — comportamento da home.
 *
 * Escopo: sidebar e dropdown da conta. Nada além disso.
 * Nenhuma chamada de rede: só interface.
 *
 * Carregado com <script type="module">, que executa depois do parse do
 * documento — por isso não há espera por DOMContentLoaded.
 */

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
   Ligação
   ========================================================================= */

const sidebar = initSidebar();
const dropdowns = initDropdowns();

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
