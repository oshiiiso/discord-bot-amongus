import { BrowserWindow, dialog } from 'electron';
import { MSG } from '../shared/messages';

let skipMuteConfirmForSession = false;

export async function confirmMuteAll(
  parent: BrowserWindow | null,
  presetName: string,
  guildName: string | null,
  channelName: string | null,
  memberCount: number,
): Promise<boolean> {
  if (skipMuteConfirmForSession) {
    return true;
  }

  const targetLabel = channelName ?? presetName;
  const serverLabel = guildName ? `${guildName} / ` : '';

  const dialogOptions = {
    type: 'warning' as const,
    buttons: ['キャンセル', 'ミュートする'],
    defaultId: 1,
    cancelId: 0,
    title: MSG.mute.confirmTitle,
    message: MSG.mute.confirmMessage,
    detail: `${serverLabel}${targetLabel}（${memberCount}人）`,
    checkboxLabel: MSG.mute.confirmSkip,
    checkboxChecked: false,
    noLink: true,
  };

  const result = parent
    ? await dialog.showMessageBox(parent, dialogOptions)
    : await dialog.showMessageBox(dialogOptions);

  if (result.checkboxChecked) {
    skipMuteConfirmForSession = true;
  }

  return result.response === 1;
}
