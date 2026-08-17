function setupTitlebar() {
  const closeBtn = document.getElementById('titlebar-close');
  closeBtn?.addEventListener('click', () => {
    void window.amongUsBot?.closeWindow?.();
  });

  const settingsBtn = document.getElementById('titlebar-settings');
  settingsBtn?.addEventListener('click', () => {
    void window.amongUsBot?.openSettings?.();
  });

  const menuBtn = document.getElementById('titlebar-menu');
  const menuDropdown = document.getElementById('titlebar-menu-dropdown');
  const versionLabel = document.getElementById('titlebar-menu-version');

  if (!menuBtn || !menuDropdown) {
    return;
  }

  let appInfo = null;

  async function ensureAppInfo() {
    if (appInfo) {
      return appInfo;
    }

    try {
      appInfo = await window.amongUsBot?.getAppInfo?.();
    } catch {
      appInfo = { version: '0.0.0' };
    }

    if (versionLabel && appInfo?.version) {
      versionLabel.textContent = `バージョン ${appInfo.version}`;
    }

    return appInfo;
  }

  function closeMenu() {
    menuDropdown.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
  }

  function openMenu() {
    menuDropdown.hidden = false;
    menuBtn.setAttribute('aria-expanded', 'true');
    void ensureAppInfo();
  }

  menuBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    if (menuDropdown.hidden) {
      openMenu();
    } else {
      closeMenu();
    }
  });

  document.addEventListener('click', () => {
    closeMenu();
  });

  menuDropdown.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  menuDropdown.querySelector('[data-action="help"]')?.addEventListener('click', () => {
    closeMenu();
    void window.amongUsBot?.openHelp?.();
  });

  menuDropdown.querySelector('[data-action="contact"]')?.addEventListener('click', () => {
    closeMenu();
    void window.amongUsBot?.openContact?.();
  });

  menuDropdown.querySelector('[data-action="check-update"]')?.addEventListener('click', () => {
    closeMenu();
    void window.amongUsBot?.checkForUpdates?.();
  });

  void ensureAppInfo();
}

setupTitlebar();
