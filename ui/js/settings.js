const form = document.getElementById('settings-form');
const feedback = document.getElementById('feedback');
const discordTokenInput = document.getElementById('discord-token');
const tokenChangeBtn = document.getElementById('token-change-btn');
const tokenStatus = document.getElementById('token-status');
const presetList = document.getElementById('preset-list');
const addPresetBtn = document.getElementById('add-preset-btn');
const shortcutMuteInput = document.getElementById('shortcut-mute');
const shortcutUnmuteInput = document.getElementById('shortcut-unmute');
const minimizeToTrayInput = document.getElementById('minimize-to-tray');
const storageField = document.getElementById('storage-field');
const storagePath = document.getElementById('storage-path');
const storageChangeBtn = document.getElementById('storage-change-btn');
const storageResetBtn = document.getElementById('storage-reset-btn');
const storagePortableNote = document.getElementById('storage-portable-note');
const tabButtons = [...document.querySelectorAll('.settings-tab')];
const tabPanels = [...document.querySelectorAll('.settings-tab-panel')];

let hasStoredToken = false;
let tokenEditing = false;
let presets = [];
let activePresetId = '';
let presetInfoMap = new Map();

function setFeedback(message, type = '') {
  setFeedbackBar(feedback, message, type);
}

async function loadStorageInfo() {
  if (!window.amongUsBot?.getStorageInfo) {
    return;
  }

  const info = await window.amongUsBot.getStorageInfo();

  if (info.portable) {
    storageField.hidden = true;
    storagePortableNote.hidden = false;
    return;
  }

  storageField.hidden = false;
  storagePortableNote.hidden = true;
  storagePath.textContent = info.dataDir;
  storageResetBtn.disabled = info.dataDir === info.defaultDataDir;
}

async function changeStorageDir(targetDir) {
  const result = await window.amongUsBot.changeDataDir(targetDir);
  if (!result?.success) {
    setFeedback(
      result?.message || '保存先の変更に失敗しました',
      'error',
    );
    return;
  }

  setFeedback('保存先を変更しました。再起動します...', 'success');
}

storageChangeBtn.addEventListener('click', () => {
  void (async () => {
    const picked = await window.amongUsBot.pickDataDir();
    if (!picked) {
      return;
    }

    await changeStorageDir(picked);
  })();
});

storageResetBtn.addEventListener('click', () => {
  void changeStorageDir(null);
});

function switchTab(tabId) {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabId;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  tabPanels.forEach((panel) => {
    panel.classList.toggle('is-active', panel.dataset.tabPanel === tabId);
  });
}

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    switchTab(button.dataset.tab);
  });
});

function displayToElectron(display) {
  return display
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (part === 'Ctrl') return 'CommandOrControl';
      if (part === 'Cmd') return 'Command';
      return part;
    })
    .join('+');
}

function createPresetId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `preset-${Date.now()}`;
}

function keyEventToAccelerator(event) {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) {
    return null;
  }

  const parts = [];
  if (event.ctrlKey || event.metaKey) {
    parts.push('CommandOrControl');
  }
  if (event.altKey) {
    parts.push('Alt');
  }
  if (event.shiftKey) {
    parts.push('Shift');
  }

  let key = event.key;
  if (key === ' ') {
    key = 'Space';
  } else if (key.startsWith('Arrow')) {
    key = key.replace('Arrow', '');
  } else if (key.length === 1) {
    key = key.toUpperCase();
  }

  parts.push(key);

  const electron = parts.join('+');
  return { electron, display: electronToDisplay(electron) };
}

function setupShortcutCapture(input) {
  input.placeholder = 'クリックしてキーを入力';

  input.addEventListener('focus', () => {
    input.classList.add('shortcut-input--recording');
    input.dataset.prevValue = input.value;
    input.value = '';
    input.placeholder = 'キーを押してください...';
  });

  input.addEventListener('blur', () => {
    input.classList.remove('shortcut-input--recording');
    if (!input.value) {
      input.value = input.dataset.prevValue || '';
    }
    input.placeholder = 'クリックしてキーを入力';
  });

  input.addEventListener('keydown', (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.key === 'Escape') {
      input.value = input.dataset.prevValue || '';
      input.blur();
      return;
    }

    const accelerator = keyEventToAccelerator(event);
    if (!accelerator) {
      return;
    }

    input.value = accelerator.display;
    input.dataset.electronValue = accelerator.electron;
    input.blur();
  });
}

function getShortcutValue(input) {
  if (input.dataset.electronValue) {
    return input.dataset.electronValue;
  }

  const display = input.value.trim();
  if (!display) {
    return '';
  }

  return displayToElectron(display);
}

function updateTokenField() {
  if (hasStoredToken && !tokenEditing) {
    discordTokenInput.disabled = true;
    discordTokenInput.value = '';
    discordTokenInput.placeholder = '設定済み';
    tokenChangeBtn.hidden = false;
    tokenChangeBtn.textContent = '変更';
    tokenStatus.textContent = '設定済み';
    return;
  }

  discordTokenInput.disabled = false;
  tokenChangeBtn.hidden = !hasStoredToken;
  tokenChangeBtn.textContent = hasStoredToken ? 'キャンセル' : '変更';

  if (!hasStoredToken) {
    discordTokenInput.placeholder = 'Botタブでコピーしたトークン';
    tokenStatus.textContent = '未設定（メイン画面で設定してください）';
  } else {
    discordTokenInput.placeholder = '新しいトークンを入力';
    tokenStatus.textContent = '変更中';
  }
}

function renderPresetList() {
  presetList.innerHTML = '';

  if (!presets.length) {
    const empty = document.createElement('p');
    empty.className = 'preset-list__empty';
    empty.textContent = 'プリセットがありません。「追加」で登録してください。';
    presetList.appendChild(empty);
    return;
  }

  presets.forEach((preset, index) => {
    const info = presetInfoMap.get(preset.id);
    const resolved = formatPresetLabel(
      preset.name,
      info?.guildName,
      info?.voiceChannelName,
    );
    const showResolved =
      info?.guildName &&
      info?.voiceChannelName &&
      resolved !== (preset.name || `プリセット${index + 1}`);

    const card = document.createElement('div');
    card.className = 'preset-card';
    card.dataset.presetId = preset.id;

    card.innerHTML = `
      <div class="preset-card__header">
        <label class="preset-card__active">
          <input type="radio" name="active-preset" value="${preset.id}" ${
            preset.id === activePresetId ? 'checked' : ''
          } />
          <span>メインで使う</span>
        </label>
        <button class="btn btn--ghost btn--small preset-card__delete" type="button" ${
          presets.length <= 1 ? 'disabled' : ''
        }>削除</button>
      </div>
      ${
        showResolved
          ? `<p class="preset-card__target">${escapeHtml(resolved)}</p>`
          : ''
      }
      <label class="field">
        <span>名前</span>
        <input class="preset-name" type="text" value="${escapeHtml(preset.name)}" placeholder="例: ゲーム用VC" />
      </label>
      <label class="field">
        <span>サーバーID</span>
        <input class="preset-guild-id" type="text" value="${escapeHtml(preset.guildId)}" placeholder="例: 123456789012345678" required />
      </label>
      <label class="field">
        <span>VCチャンネルID</span>
        <input class="preset-vc-id" type="text" value="${escapeHtml(preset.voiceChannelId)}" placeholder="例: 987654321098765432" required />
      </label>
    `;

    const deleteBtn = card.querySelector('.preset-card__delete');
    deleteBtn.addEventListener('click', () => {
      if (presets.length <= 1) {
        return;
      }
      presets = presets.filter((item) => item.id !== preset.id);
      if (activePresetId === preset.id) {
        activePresetId = presets[0]?.id ?? '';
      }
      renderPresetList();
    });

    const radio = card.querySelector('input[type="radio"]');
    radio.addEventListener('change', () => {
      if (radio.checked) {
        activePresetId = preset.id;
      }
    });

    presetList.appendChild(card);
  });
}

function collectPresetsFromDom() {
  return [...presetList.querySelectorAll('.preset-card')].map((card, index) => {
    const id = card.dataset.presetId;
    const name =
      card.querySelector('.preset-name')?.value.trim() ||
      `プリセット${index + 1}`;
    const guildId = card.querySelector('.preset-guild-id')?.value.trim() ?? '';
    const voiceChannelId =
      card.querySelector('.preset-vc-id')?.value.trim() ?? '';

    return { id, name, guildId, voiceChannelId };
  });
}

tokenChangeBtn.addEventListener('click', () => {
  if (hasStoredToken && !tokenEditing) {
    tokenEditing = true;
    discordTokenInput.value = '';
    updateTokenField();
    discordTokenInput.focus();
    return;
  }

  tokenEditing = false;
  discordTokenInput.value = '';
  updateTokenField();
});

addPresetBtn.addEventListener('click', () => {
  const id = createPresetId();
  presets.push({
    id,
    name: `プリセット${presets.length + 1}`,
    guildId: '',
    voiceChannelId: '',
  });
  activePresetId = id;
  renderPresetList();
});

async function loadConfig() {
  const config = await window.amongUsBot.getConfig();
  presets = config.presets.map((preset) => ({ ...preset }));
  activePresetId = config.activePresetId || presets[0]?.id || '';

  if (window.amongUsBot.getPresetsInfo) {
    const list = await window.amongUsBot.getPresetsInfo();
    presetInfoMap = new Map(list.map((item) => [item.presetId, item]));
  }

  renderPresetList();
  shortcutMuteInput.value = electronToDisplay(config.shortcuts.muteAll);
  shortcutUnmuteInput.value = electronToDisplay(config.shortcuts.unmuteAll);
  delete shortcutMuteInput.dataset.electronValue;
  delete shortcutUnmuteInput.dataset.electronValue;
  minimizeToTrayInput.checked = config.minimizeToTray;
  hasStoredToken = config.hasDiscordToken;
  tokenEditing = false;
  updateTokenField();
  await loadStorageInfo();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const collectedPresets = collectPresetsFromDom();
  const selectedRadio = presetList.querySelector('input[name="active-preset"]:checked');
  const nextActivePresetId = selectedRadio?.value || collectedPresets[0]?.id || '';

  const payload = {
    presets: collectedPresets,
    activePresetId: nextActivePresetId,
    shortcuts: {
      muteAll: getShortcutValue(shortcutMuteInput),
      unmuteAll: getShortcutValue(shortcutUnmuteInput),
    },
    minimizeToTray: minimizeToTrayInput.checked,
  };

  const token = discordTokenInput.value.trim();
  if (token) {
    payload.discordToken = token;
  }

  try {
    const saved = await window.amongUsBot.saveConfig(payload);
    presets = saved.presets.map((preset) => ({ ...preset }));
    activePresetId = saved.activePresetId;
    renderPresetList();
    hasStoredToken = saved.hasDiscordToken;
    tokenEditing = false;
    discordTokenInput.value = '';
    updateTokenField();
    setFeedback('設定を保存しました', 'success');
  } catch (error) {
    setFeedback(getErrorMessage(error, '保存に失敗しました'), 'error');
  }
});

setupShortcutCapture(shortcutMuteInput);
setupShortcutCapture(shortcutUnmuteInput);
void loadConfig();
