function renderMarkdown(markdown) {
  if (typeof marked === 'undefined') {
    throw new Error('Markdown レンダラーが読み込まれていません');
  }

  marked.setOptions({
    gfm: true,
    breaks: false,
  });

  marked.use({
    renderer: {
      html() {
        return '';
      },
    },
  });

  return marked.parse(markdown || '');
}

function setupHelpLinks(container) {
  container.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link) {
      return;
    }

    const href = link.getAttribute('href');
    if (!href || href.startsWith('#')) {
      return;
    }

    event.preventDefault();
    void window.amongUsBot?.openExternal?.(href);
  });
}

async function init() {
  const container = document.getElementById('help-content');
  if (!container || !window.amongUsBot) {
    return;
  }

  try {
    const result = await window.amongUsBot.getHelpContent();
    if (result.error) {
      container.innerHTML = `<p class="help-error">${escapeHtml(
        result.error,
      )}</p>`;
      return;
    }

    container.innerHTML = renderMarkdown(result.content || '');
    setupHelpLinks(container);
  } catch (error) {
    container.innerHTML = `<p class="help-error">${escapeHtml(
      getErrorMessage(error, 'ヘルプの読み込みに失敗しました'),
    )}</p>`;
  }
}

void init();
