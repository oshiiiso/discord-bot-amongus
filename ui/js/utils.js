function electronToDisplay(accelerator) {
  return accelerator.replace(/CommandOrControl/g, 'Ctrl');
}

function setFeedbackBar(element, message, type = '') {
  element.textContent = message;
  element.className = type
    ? `feedback-bar feedback-bar--${type}`
    : 'feedback-bar';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getErrorMessage(error, fallback = 'エラーが発生しました') {
  return error instanceof Error ? error.message : fallback;
}

function formatPresetLabel(presetName, guildName, voiceChannelName) {
  if (guildName && voiceChannelName) {
    return `${guildName} / ${voiceChannelName}`;
  }

  return presetName?.trim() || '名称未設定';
}
