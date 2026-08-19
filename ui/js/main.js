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
const setupTokenHint = document.getElementById('setup-token-hint');
const setupPresetNameInput = document.getElementById('setup-preset-name');
const setupGuildIdInput = document.getElementById('setup-guild-id');
const setupVcIdInput = document.getElementById('setup-vc-id');
const setupSubmitBtn = document.getElementById('setup-submit');
const setupFeedback = document.getElementById('setup-feedback');
const muteBadge = document.getElementById('mute-badge');
const permissionWarning = document.getElementById('permission-warning');
const historyList = document.getElementById('history-list');
const trayHint = document.getElementById('tray-hint');
const trayHintDismiss = document.getElementById('tray-hint-dismiss');
const updateBanner = document.getElementById('update-banner');
const updateBannerText = document.getElementById('update-banner-text');
const updateBannerActions = document.getElementById('update-banner-actions');

let targetRefreshMs = 10000;
let targetRefreshTimer = null;
let setupConnectionTimer = null;
let isSetupMode = false;
let awaitingSetupConnection = false;
let presetInfoMap = new Map();

const SETUP_CONNECTION_TIMEOUT_MS = 60_000;

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

function hasConfiguredPreset(config) {
  return config.presets.some(
    (preset) => preset.guildId?.trim() && preset.voiceChannelId?.trim(),
  );
}

function needsInitialSetup(config) {
  return !config.hasDiscordToken || !hasConfiguredPreset(config);
}

function focusSetupField(config) {
  if (!config.hasDiscordToken) {
    setupTokenInput.focus();
    return;
  }

  if (!setupGuildIdInput.value.trim()) {
    setupGuildIdInput.focus();
    return;
  }

  setupVcIdInput.focus();
}

function prefillSetupForm(config) {
  const preset =
    config.presets.find((item) => item.id === config.activePresetId) ??
    config.presets[0];

  if (preset) {
    setupPresetNameInput.value = preset.name || 'ゲーム用VC';
    setupGuildIdInput.value = preset.guildId || '';
    setupVcIdInput.value = preset.voiceChannelId || '';
  } else {
    setupPresetNameInput.value = 'ゲーム用VC';
    setupGuildIdInput.value = '';
    setupVcIdInput.value = '';
  }

  if (config.hasDiscordToken) {
    setupTokenInput.value = '';
    setupTokenInput.placeholder = '設定済み（変更する場合のみ入力）';
    setupTokenInput.required = false;
    setupTokenHint.textContent = 'トークンは保存済みです。変更しない場合は空欄のままで構いません。';
  } else {
    setupTokenInput.placeholder = 'Botタブでコピーしたトークン';
    setupTokenInput.required = true;
    setupTokenHint.textContent = 'Developer Portal の Bot タブでコピー';
  }
}

function setSetupMode(enabled) {
  isSetupMode = enabled;
  setupCard.hidden = !enabled;
  mainContent.hidden = enabled;
  window.dispatchEvent(new Event('layoutchange'));
}

function showMainPanel() {
  clearSetupConnectionTimer();
  awaitingSetupConnection = false;
  setSetupMode(false);
}

function showSetupPanel() {
  clearSetupConnectionTimer();
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
    const actionLabel = entry.action === 'mute' ? 'ミュート' : 'ミュート解除';
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

  const showStates = [
    'available',
    'downloading',
    'downloaded',
    'not-available',
    'error',
    'disabled',
    'checking',
  ];
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

  if (['available', 'downloaded', 'not-available', 'error', 'disabled', 'checking'].includes(status.state)) {
    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'btn btn--ghost btn--small';
    dismissBtn.type = 'button';
    dismissBtn.textContent = '後で';
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
  const show =
    !isSetupMode &&
    config.hasDiscordToken &&
    !config.trayHintDismissed;

  trayHint.hidden = !show;
  window.dispatchEvent(new Event('layoutchange'));
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
    const label = formatPresetLabel(preset.name);
    const detail = formatPresetDetail(info?.guildName, info?.voiceChannelName);

    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = label;
    option.title = detail || label;
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

function clearSetupConnectionTimer() {
  if (setupConnectionTimer) {
    window.clearTimeout(setupConnectionTimer);
    setupConnectionTimer = null;
  }
}

function startSetupConnectionTimer() {
  clearSetupConnectionTimer();
  setupConnectionTimer = window.setTimeout(() => {
    if (!awaitingSetupConnection) {
      return;
    }

    awaitingSetupConnection = false;
    setSetupFeedback(
      '接続がタイムアウトしました。設定 → Bot でトークンを確認してください。',
      'error',
    );
    setupSubmitBtn.disabled = false;
  }, SETUP_CONNECTION_TIMEOUT_MS);
}

function handleSetupConnectionStatus(status) {
  if (!awaitingSetupConnection) {
    return;
  }

  if (status.state === 'ready') {
    clearSetupConnectionTimer();
    showMainPanel();
    setSetupFeedback('');
    void refreshAll();
    return;
  }

  if (status.state === 'error') {
    clearSetupConnectionTimer();
    awaitingSetupConnection = false;
    setSetupFeedback(
      status.message || '接続できませんでした。設定 → Bot でトークンを確認してください。',
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
  renderPresetOptions(config);
  renderShortcuts(config);
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
    const config = await window.amongUsBot.getConfig();
    const token = setupTokenInput.value.trim();
    const presetName = setupPresetNameInput.value.trim() || 'ゲーム用VC';
    const guildId = setupGuildIdInput.value.trim();
    const voiceChannelId = setupVcIdInput.value.trim();

    if (!config.hasDiscordToken && !token) {
      setSetupFeedback('トークンを入力してください', 'error');
      return;
    }

    if (!guildId || !voiceChannelId) {
      setSetupFeedback('サーバーIDとVCチャンネルIDを入力してください', 'error');
      return;
    }

    setupSubmitBtn.disabled = true;
    setSetupFeedback('保存中...');

    const existingPreset =
      config.presets.find((item) => item.id === config.activePresetId) ??
      config.presets[0];
    const presetId = existingPreset?.id ?? createPresetId();

    const payload = {
      presets: [
        {
          id: presetId,
          name: presetName,
          guildId,
          voiceChannelId,
        },
      ],
      activePresetId: presetId,
    };

    if (token) {
      payload.discordToken = token;
    }

    try {
      const saved = await window.amongUsBot.saveConfig(payload);

      if (token && !saved.hasDiscordToken) {
        setSetupFeedback('トークンの保存に失敗しました', 'error');
        setupSubmitBtn.disabled = false;
        return;
      }

      if (!hasConfiguredPreset(saved)) {
        setSetupFeedback('プリセットの保存に失敗しました', 'error');
        setupSubmitBtn.disabled = false;
        return;
      }

      setupTokenInput.value = '';

      if (token) {
        setSetupFeedback('接続中...');
        awaitingSetupConnection = true;
        startSetupConnectionTimer();

        const status = await window.amongUsBot.getBotStatus();
        handleSetupConnectionStatus(status);
        if (!awaitingSetupConnection) {
          return;
        }

        renderStatus(status);
        return;
      }

      showMainPanel();
      setSetupFeedback('');
      await refreshAll();
    } catch (error) {
      setSetupFeedback(getErrorMessage(error, '設定の保存に失敗しました'), 'error');
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

  if (needsInitialSetup(config)) {
    showSetupPanel();
    prefillSetupForm(config);
    focusSetupField(config);
    return;
  }

  renderPresetOptions(config);
  renderShortcuts(config);
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

async function init() {
  if (!window.amongUsBot) {
    setFeedback('アプリの初期化に失敗しました', 'error');
    return;
  }

  try {
    const runtime = await window.amongUsBot.getRuntimeConfig();
    targetRefreshMs = runtime.targetRefreshMs;

    const config = await window.amongUsBot.getConfig();
    renderPresetOptions(config);
    renderShortcuts(config);
    renderTrayHint(config);

    const updateStatus = await window.amongUsBot.getUpdateStatus();
    renderUpdateBanner(updateStatus);

    if (needsInitialSetup(config)) {
      showSetupPanel();
      prefillSetupForm(config);
      focusSetupField(config);
      return;
    }

    showMainPanel();
    await refreshAll();
  } catch (error) {
    setFeedback(getErrorMessage(error, 'ステータス取得に失敗しました'), 'error');
    muteBtn.disabled = true;
    unmuteBtn.disabled = true;
  }
}

void init();
