const statusCard = document.getElementById('status-card');
const statusDot = document.getElementById('status-dot');
const statusLabel = document.getElementById('status-label');
const statusDetail = document.getElementById('status-detail');
const feedback = document.getElementById('feedback');
const muteBtn = document.getElementById('mute-btn');
const unmuteBtn = document.getElementById('unmute-btn');
const presetSelect = document.getElementById('preset-select');
const targetGuildName = document.getElementById('target-guild-name');
const targetVcName = document.getElementById('target-vc-name');
const targetMemberCount = document.getElementById('target-member-count');
const shortcutMuteHint = document.getElementById('shortcut-mute-hint');
const shortcutUnmuteHint = document.getElementById('shortcut-unmute-hint');
const setupCard = document.getElementById('setup-card');
const mainContent = document.getElementById('main-content');
const setupForm = document.getElementById('setup-form');
const setupTokenInput = document.getElementById('setup-token');
const setupSubmitBtn = document.getElementById('setup-submit');
const setupFeedback = document.getElementById('setup-feedback');
const muteBadge = document.getElementById('mute-badge');
const permissionWarning = document.getElementById('permission-warning');
const historyList = document.getElementById('history-list');
const trayHint = document.getElementById('tray-hint');
const trayHintDismiss = document.getElementById('tray-hint-dismiss');
const storageSetup = document.getElementById('storage-setup');
const storageSetupPath = document.getElementById('storage-setup-path');
const storageSetupChange = document.getElementById('storage-setup-change');
const storageSetupConfirm = document.getElementById('storage-setup-confirm');
const updateBanner = document.getElementById('update-banner');
const updateBannerText = document.getElementById('update-banner-text');
const updateBannerActions = document.getElementById('update-banner-actions');

let targetRefreshMs = 10000;
let targetRefreshTimer = null;
let isSetupMode = false;
let awaitingSetupConnection = false;
let presetInfoMap = new Map();
let storageInfo = null;

const stateLabels = {
  ready: '接続済み',
  connecting: '接続中...',
  disconnected: '未接続',
  error: 'エラー',
};

function setFeedback(message, type = '') {
  setFeedbackBar(feedback, message, type);
}

function setSetupFeedback(message, type = '') {
  setupFeedback.textContent = message;
  setupFeedback.className = type
    ? `setup-card__hint setup-card__hint--${type}`
    : 'setup-card__hint';
}

function setSetupMode(enabled) {
  isSetupMode = enabled;
  setupCard.hidden = !enabled;
  mainContent.hidden = enabled;
  window.dispatchEvent(new Event('layoutchange'));
}

function showMainPanel() {
  awaitingSetupConnection = false;
  setSetupMode(false);
}

function showSetupPanel() {
  awaitingSetupConnection = false;
  setSetupMode(true);
}

function formatHistoryTime(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function renderOperationHistory(entries) {
  historyList.innerHTML = '';

  if (!entries?.length) {
    const empty = document.createElement('li');
    empty.className = 'history-list__empty';
    empty.textContent = 'まだ操作がありません';
    historyList.appendChild(empty);
    window.dispatchEvent(new Event('layoutchange'));
    return;
  }

  for (const entry of entries) {
    const item = document.createElement('li');
    item.className = 'history-list__item';

    const time = document.createElement('span');
    time.className = 'history-list__time';
    time.textContent = formatHistoryTime(entry.timestamp);

    const text = document.createElement('span');
    const actionLabel = entry.action === 'mute' ? 'ミュート' : '解除';
    text.className = `history-list__text history-list__text--${
      entry.success ? 'success' : 'error'
    }`;
    text.textContent = `${actionLabel} · ${entry.presetName} · ${entry.message}`;

    item.append(time, text);
    historyList.appendChild(item);
  }

  window.dispatchEvent(new Event('layoutchange'));
}

function renderUpdateBanner(status) {
  if (!updateBanner || !updateBannerText || !updateBannerActions || !status) {
    return;
  }

  const showStates = ['available', 'downloading', 'downloaded', 'not-available', 'error'];
  if (!showStates.includes(status.state)) {
    updateBanner.hidden = true;
    window.dispatchEvent(new Event('layoutchange'));
    return;
  }

  updateBannerText.textContent = status.message || '';
  updateBannerActions.innerHTML = '';

  if (status.state === 'available') {
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'btn btn--primary btn--small';
    downloadBtn.type = 'button';
    downloadBtn.textContent = 'ダウンロード';
    downloadBtn.addEventListener('click', () => {
      void window.amongUsBot.downloadUpdate();
    });
    updateBannerActions.appendChild(downloadBtn);
  }

  if (status.state === 'downloaded') {
    const installBtn = document.createElement('button');
    installBtn.className = 'btn btn--primary btn--small';
    installBtn.type = 'button';
    installBtn.textContent = '再起動して更新';
    installBtn.addEventListener('click', () => {
      void window.amongUsBot.installUpdate();
    });
    updateBannerActions.appendChild(installBtn);
  }

  if (['available', 'downloaded', 'not-available', 'error'].includes(status.state)) {
    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'btn btn--ghost btn--small';
    dismissBtn.type = 'button';
    dismissBtn.textContent = '閉じる';
    dismissBtn.addEventListener('click', () => {
      updateBanner.hidden = true;
      window.dispatchEvent(new Event('layoutchange'));
    });
    updateBannerActions.appendChild(dismissBtn);
  }

  updateBanner.hidden = false;
  updateBanner.dataset.state = status.state;
  window.dispatchEvent(new Event('layoutchange'));
}

function renderTrayHint(config) {
  const storageReady =
    storageInfo?.portable || config.storageLocationConfirmed;

  const show =
    !isSetupMode &&
    config.hasDiscordToken &&
    storageReady &&
    !config.trayHintDismissed;

  trayHint.hidden = !show;
  window.dispatchEvent(new Event('layoutchange'));
}

function renderStorageSetup(config) {
  const show =
    !isSetupMode &&
    config.hasDiscordToken &&
    storageInfo?.canChange &&
    !config.storageLocationConfirmed;

  storageSetup.hidden = !show;
  if (show && storageInfo) {
    storageSetupPath.textContent = storageInfo.dataDir;
  }
  window.dispatchEvent(new Event('layoutchange'));
}

async function refreshStorageInfo() {
  if (!window.amongUsBot?.getStorageInfo) {
    storageInfo = null;
    return;
  }

  storageInfo = await window.amongUsBot.getStorageInfo();
}

function renderPresetOptions(config) {
  const previousValue = presetSelect.value;
  presetSelect.innerHTML = '';

  if (!config.presets.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'プリセット未設定';
    presetSelect.appendChild(option);
    presetSelect.disabled = true;
    return;
  }

  presetSelect.disabled = false;
  for (const preset of config.presets) {
    const info = presetInfoMap.get(preset.id);
    const label = formatPresetLabel(
      preset.name,
      info?.guildName,
      info?.voiceChannelName,
    );

    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = label;
    option.title = preset.name && label !== preset.name ? preset.name : label;
    option.selected = preset.id === config.activePresetId;
    presetSelect.appendChild(option);
  }

  if (config.presets.some((preset) => preset.id === previousValue)) {
    presetSelect.value = previousValue;
  }
}

async function refreshPresetInfo() {
  if (!window.amongUsBot?.getPresetsInfo) {
    presetInfoMap = new Map();
    return;
  }

  const list = await window.amongUsBot.getPresetsInfo();
  presetInfoMap = new Map(list.map((item) => [item.presetId, item]));
}

function renderMuteBadge(active) {
  muteBadge.hidden = !active;
}

function renderPermissionWarning(warning) {
  if (warning) {
    permissionWarning.hidden = false;
    permissionWarning.textContent = warning;
    return;
  }

  permissionWarning.hidden = true;
  permissionWarning.textContent = '';
}

function renderTargetInfo(targetInfo) {
  if (!targetInfo) {
    targetGuildName.textContent = '未設定';
    targetGuildName.classList.add('is-empty');
    targetVcName.textContent = '未設定';
    targetVcName.classList.add('is-empty');
    targetMemberCount.textContent = '-';
    renderMuteBadge(false);
    renderPermissionWarning(null);
    return;
  }

  targetGuildName.textContent = targetInfo.guildName ?? '取得できません';
  targetGuildName.classList.toggle('is-empty', !targetInfo.guildName);
  targetGuildName.title = targetInfo.guildId;

  targetVcName.textContent = targetInfo.voiceChannelName ?? '取得できません';
  targetVcName.classList.toggle('is-empty', !targetInfo.voiceChannelName);
  targetVcName.title = targetInfo.voiceChannelId;

  targetMemberCount.textContent =
    targetInfo.memberCount >= 0 ? `${targetInfo.memberCount}人` : '-';

  renderMuteBadge(Boolean(targetInfo.muteSessionActive));
  renderPermissionWarning(targetInfo.permissionWarning ?? null);
}

function renderShortcuts(config) {
  shortcutMuteHint.textContent = config.shortcuts.muteAll
    ? electronToDisplay(config.shortcuts.muteAll)
    : '';
  shortcutUnmuteHint.textContent = config.shortcuts.unmuteAll
    ? electronToDisplay(config.shortcuts.unmuteAll)
    : '';
}

function renderStatus(status) {
  if (isSetupMode) {
    return;
  }

  statusLabel.textContent = stateLabels[status.state] ?? status.state;
  statusDetail.textContent = status.username
    ? `${status.username} · ${status.message}`
    : status.message;

  statusCard.className = 'status-card';
  statusDot.className = 'status-dot';

  if (status.state === 'ready') {
    statusCard.classList.add('status-card--ready');
    statusDot.classList.add('status-dot--ready');
  } else if (status.state === 'connecting') {
    statusCard.classList.add('status-card--connecting');
    statusDot.classList.add('status-dot--connecting');
  } else if (status.state === 'error') {
    statusCard.classList.add('status-card--error');
    statusDot.classList.add('status-dot--error');
  } else {
    statusCard.classList.add('status-card--disconnected');
    statusDot.classList.add('status-dot--disconnected');
  }

  const isReady = status.state === 'ready';
  muteBtn.disabled = !isReady;
  unmuteBtn.disabled = !isReady;

  if (isReady) {
    startTargetRefresh();
  } else {
    stopTargetRefresh();
  }
}

function handleSetupConnectionStatus(status) {
  if (!awaitingSetupConnection) {
    return;
  }

  if (status.state === 'ready') {
    showMainPanel();
    setSetupFeedback('');
    void refreshAll();
    return;
  }

  if (status.state === 'error') {
    awaitingSetupConnection = false;
    setSetupFeedback(
      status.message || '接続できませんでした。設定 > Bot でトークンを確認してください。',
      'error',
    );
    setupSubmitBtn.disabled = false;
  }
}

function startTargetRefresh() {
  stopTargetRefresh();
  targetRefreshTimer = window.setInterval(() => {
    void refreshTargetInfo();
    void refreshPresetInfo().then(() => {
      void window.amongUsBot.getConfig().then(renderPresetOptions);
    });
  }, targetRefreshMs);
}

function stopTargetRefresh() {
  if (targetRefreshTimer) {
    window.clearInterval(targetRefreshTimer);
    targetRefreshTimer = null;
  }
}

async function refreshStatus() {
  const status = await window.amongUsBot.getBotStatus();
  renderStatus(status);
  handleSetupConnectionStatus(status);
}

async function refreshConfig() {
  const config = await window.amongUsBot.getConfig();
  await refreshPresetInfo();
  await refreshStorageInfo();
  renderPresetOptions(config);
  renderShortcuts(config);
  renderStorageSetup(config);
  renderTrayHint(config);
  return config;
}

async function refreshTargetInfo() {
  if (isSetupMode) {
    return;
  }

  const targetInfo = await window.amongUsBot.getTargetInfo();
  renderTargetInfo(targetInfo);
}

async function refreshAll() {
  await Promise.all([refreshStatus(), refreshConfig()]);
  await refreshTargetInfo();
  await refreshOperationHistory();
}

async function refreshOperationHistory() {
  if (isSetupMode || !window.amongUsBot.getOperationHistory) {
    return;
  }

  const entries = await window.amongUsBot.getOperationHistory();
  renderOperationHistory(entries);
}

async function runAction(action) {
  setFeedback('実行中...');
  muteBtn.disabled = true;
  unmuteBtn.disabled = true;

  try {
    const result =
      action === 'mute'
        ? await window.amongUsBot.muteAll()
        : await window.amongUsBot.unmuteAll();

    if (result.cancelled) {
      setFeedback('');
    } else {
      setFeedback(result.message, result.success ? 'success' : 'error');
    }
  } catch (error) {
    setFeedback(getErrorMessage(error, '操作に失敗しました'), 'error');
  } finally {
    try {
      await refreshAll();
    } catch {
      muteBtn.disabled = false;
      unmuteBtn.disabled = false;
    }
  }
}

muteBtn.addEventListener('click', () => {
  void runAction('mute');
});

unmuteBtn.addEventListener('click', () => {
  void runAction('unmute');
});

presetSelect.addEventListener('change', () => {
  void (async () => {
    const presetId = presetSelect.value;
    if (!presetId) {
      return;
    }

    try {
      await window.amongUsBot.setActivePreset(presetId);
      await refreshAll();
    } catch (error) {
      setFeedback(getErrorMessage(error, 'プリセットの切り替えに失敗しました'), 'error');
    }
  })();
});

setupForm.addEventListener('submit', (event) => {
  event.preventDefault();

  void (async () => {
    const token = setupTokenInput.value.trim();
    if (!token) {
      setSetupFeedback('トークンを入力してください', 'error');
      return;
    }

    setupSubmitBtn.disabled = true;
    setSetupFeedback('接続中...');

    try {
      const saved = await window.amongUsBot.saveConfig({ discordToken: token });
      if (!saved.hasDiscordToken) {
        setSetupFeedback('トークンの保存に失敗しました', 'error');
        setupSubmitBtn.disabled = false;
        return;
      }

      setupTokenInput.value = '';
      awaitingSetupConnection = true;

      const status = await window.amongUsBot.getBotStatus();
      handleSetupConnectionStatus(status);
      if (!awaitingSetupConnection) {
        return;
      }

      renderStatus(status);
    } catch (error) {
      setSetupFeedback(getErrorMessage(error, '接続に失敗しました'), 'error');
    } finally {
      if (!awaitingSetupConnection) {
        setupSubmitBtn.disabled = false;
      }
    }
  })();
});

window.amongUsBot.onBotStatusChanged((payload) => {
  if (payload && typeof payload === 'object' && 'state' in payload) {
    handleSetupConnectionStatus(payload);
    renderStatus(payload);
    void refreshTargetInfo();
    if (payload.state === 'ready') {
      void refreshConfig();
    }
    return;
  }

  if (!payload || typeof payload !== 'object') {
    return;
  }

  if ('muteSessionActive' in payload) {
    renderMuteBadge(Boolean(payload.muteSessionActive));
  }

  if ('operationHistory' in payload && Array.isArray(payload.operationHistory)) {
    renderOperationHistory(payload.operationHistory);
  }

  if ('lastAction' in payload) {
    const action = payload.lastAction;
    if (action && typeof action === 'object' && 'message' in action) {
      if (action.cancelled) {
        setFeedback('');
        return;
      }
      setFeedback(String(action.message), action.success ? 'success' : 'error');
      if ('muteSessionActive' in action) {
        renderMuteBadge(Boolean(action.muteSessionActive));
      }
      void refreshTargetInfo();
    }
  }
});

window.amongUsBot.onUpdateStatusChanged((status) => {
  renderUpdateBanner(status);
});

window.amongUsBot.onConfigChanged((config) => {
  if (!config || typeof config !== 'object') {
    return;
  }

  if (!config.hasDiscordToken) {
    showSetupPanel();
    setupTokenInput.focus();
  }

  renderPresetOptions(config);
  renderShortcuts(config);
  renderStorageSetup(config);
  renderTrayHint(config);

  if (!isSetupMode) {
    void refreshPresetInfo().then(() => renderPresetOptions(config));
    void refreshTargetInfo();
  }
});

trayHintDismiss.addEventListener('click', () => {
  void (async () => {
    try {
      const saved = await window.amongUsBot.saveConfig({ trayHintDismissed: true });
      renderTrayHint(saved);
    } catch {
      trayHint.hidden = true;
      window.dispatchEvent(new Event('layoutchange'));
    }
  })();
});

storageSetupConfirm.addEventListener('click', () => {
  void (async () => {
    try {
      const saved = await window.amongUsBot.saveConfig({
        storageLocationConfirmed: true,
      });
      renderStorageSetup(saved);
      renderTrayHint(saved);
    } catch (error) {
      setFeedback(getErrorMessage(error, '保存に失敗しました'), 'error');
    }
  })();
});

storageSetupChange.addEventListener('click', () => {
  void (async () => {
    try {
      const picked = await window.amongUsBot.pickDataDir();
      if (!picked) {
        return;
      }

      await window.amongUsBot.saveConfig({ storageLocationConfirmed: true });
      const result = await window.amongUsBot.changeDataDir(picked);
      if (!result?.success) {
        setFeedback(result?.message || '保存先の変更に失敗しました', 'error');
      }
    } catch (error) {
      setFeedback(getErrorMessage(error, '保存先の変更に失敗しました'), 'error');
    }
  })();
});

async function init() {
  if (!window.amongUsBot) {
    setFeedback('アプリの初期化に失敗しました', 'error');
    return;
  }

  try {
    const runtime = await window.amongUsBot.getRuntimeConfig();
    targetRefreshMs = runtime.targetRefreshMs;

    const config = await window.amongUsBot.getConfig();
    await refreshStorageInfo();
    renderPresetOptions(config);
    renderShortcuts(config);
    renderStorageSetup(config);
    renderTrayHint(config);

    const updateStatus = await window.amongUsBot.getUpdateStatus();
    renderUpdateBanner(updateStatus);

    if (config.hasDiscordToken) {
      showMainPanel();
      await refreshAll();
      return;
    }

    showSetupPanel();
    setupTokenInput.focus();
  } catch (error) {
    setFeedback(getErrorMessage(error, 'ステータス取得に失敗しました'), 'error');
    muteBtn.disabled = true;
    unmuteBtn.disabled = true;
  }
}

void init();
