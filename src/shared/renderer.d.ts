import { AmongUsBotApi } from '../main/preload';

declare global {
  interface Window {
    amongUsBot: AmongUsBotApi;
  }
}

export {};
