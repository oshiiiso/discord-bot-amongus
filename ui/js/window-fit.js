let runtimeConfig = null;

async function getRuntimeConfig() {
  if (runtimeConfig) {
    return runtimeConfig;
  }

  if (!window.amongUsBot?.getRuntimeConfig) {
    runtimeConfig = {
      targetRefreshMs: 10000,
      settingsWindow: { width: 520, height: 560 },
    };
    return runtimeConfig;
  }

  runtimeConfig = await window.amongUsBot.getRuntimeConfig();
  return runtimeConfig;
}

function getFitRoot() {
  return document.querySelector('.app-shell') ?? document.body;
}

function getScrollPanel() {
  return document.querySelector('.panel');
}

function measureContentSize() {
  const root = getFitRoot();
  const rect = root.getBoundingClientRect();
  return {
    width: Math.ceil(rect.width),
    height: Math.ceil(rect.height),
  };
}

function getWindowKind() {
  return document.body.classList.contains('page--settings') ? 'settings' : 'main';
}

async function fitWindowToContent() {
  if (!window.amongUsBot?.fitWindow) {
    return;
  }

  const kind = getWindowKind();

  if (kind === 'settings') {
    const config = await getRuntimeConfig();
    await window.amongUsBot.fitWindow(
      config.settingsWindow.width,
      config.settingsWindow.height,
      'settings',
    );
    return;
  }

  const { width, height } = measureContentSize();

  try {
    const result = await window.amongUsBot.fitWindow(width, height, kind);
    getScrollPanel()?.classList.toggle('panel--scrollable', Boolean(result?.capped));
  } catch {
    // サイズ調整失敗は無視
  }
}

function scheduleFitWindow() {
  window.requestAnimationFrame(() => {
    void fitWindowToContent();
  });
}

function setupWindowFit() {
  if (!window.amongUsBot?.fitWindow) {
    return;
  }

  scheduleFitWindow();

  if (getWindowKind() === 'main') {
    const root = getFitRoot();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => scheduleFitWindow());
      observer.observe(root);
    }

    window.addEventListener('layoutchange', scheduleFitWindow);
  }

  window.addEventListener('load', scheduleFitWindow);
}

setupWindowFit();
