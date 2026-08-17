import { BrowserWindow } from 'electron';
import { WINDOW_LAYOUT, WindowKind } from '../../shared/window-layout';

export type { WindowKind };

export interface FitWindowResult {
  width: number;
  height: number;
  capped: boolean;
}

export function fitWindowToContent(
  window: BrowserWindow,
  contentWidth: number,
  contentHeight: number,
  kind: WindowKind,
): FitWindowResult {
  const options = WINDOW_LAYOUT[kind];
  const width = Math.min(
    options.maxWidth,
    Math.max(options.minWidth, Math.ceil(contentWidth)),
  );
  const naturalHeight = Math.ceil(contentHeight);
  const capped = naturalHeight > options.maxHeight;
  const height = Math.min(
    options.maxHeight,
    Math.max(options.minHeight, naturalHeight),
  );

  window.setContentSize(width, height);

  return { width, height, capped };
}
