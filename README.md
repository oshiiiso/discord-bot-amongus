# AmongUs-Bot

Among Us 用 VC サーバーミュート操作パネル（Electron + discord.js）

個人・身内利用向けに開発したデスクトップアプリです。ソースは公開していますが、**不特定多数向けの配布は想定していません**。使う場合は自分でビルドするか、信頼できる人から渡された ZIP を利用してください。

- リポジトリ: https://github.com/oshiiiso/discord-bot-amongus
- 不具合・要望: [Issues](https://github.com/oshiiiso/discord-bot-amongus/issues)
- 使い方: [docs/USER.md](docs/USER.md)

## 機能概要

- VC 全員のサーバーミュート / 解除（ミュートセッション対応）
- VC プリセット・グローバルショートカット・トレイ常駐
- ポータブル構成（設定・ログは exe と同じフォルダに保存）
- ヘルプ・問い合わせ

## ディレクトリ構成

```
src/main/           # Electron メインプロセス
src/bot/            # Discord Bot
src/shared/         # 共通型・設定・パス解決
ui/                 # 操作パネル・設定画面
assets/             # トレイアイコンなど
docs/USER.md        # 使い方ガイド
data/               # 開発時の設定（.gitignore）
logs/               # 開発時のログ（.gitignore）
release/            # ビルド出力（.gitignore）
```

## 開発環境セットアップ

```powershell
npm install
copy .env.example .env   # 任意
npm start
```

開発時は `.env.dist` の設定が読み込まれ、`.env` で上書きできます。設定・ログはプロジェクトルートの `data/` / `logs/` に保存されます（ビルド版と同じ挙動）。

### 環境変数（`.env`）

| 変数 | 説明 | デフォルト |
|---|---|---|
| `LOG_LEVEL` | DEBUG / INFO / WARNING / ERROR | `INFO` |
| `LOG_RETENTION_DAYS` | ログ保持日数 | `30` |
| `APP_NAME` | アプリ名 | `AmongUs-Bot` |
| `TRAY_ICON_PATH` | トレイアイコン | `assets/tray-icon.png` |
| `MUTE_DELAY_MS` | 連続ミュート間隔 | `150` |
| `TARGET_REFRESH_MS` | 人数・名前の更新間隔 | `10000` |
| `BOT_RECONNECT_INITIAL_MS` | 再接続の初期待機 | `5000` |
| `BOT_RECONNECT_MAX_MS` | 再接続待機の上限 | `60000` |
| `OPERATION_HISTORY_LIMIT` | 操作履歴の件数 | `5` |
| `WINDOW_BACKGROUND` | ウィンドウ背景色 | `#141517` |
| `ISSUES_URL` | 問い合わせ先 Issue URL | — |
| `USER_GUIDE_PATH` | ヘルプ表示用 Markdown のパス | `docs/USER.md` |

`.env` は Git に含めません。Bot トークンはアプリ内設定（`data/config.json`）に保存されます。

## ビルド（身内に渡す ZIP）

```powershell
npm run dist
```

出力: `release/AmongUs-Bot-x.x.x-win.zip`

| コマンド | 出力 |
|---|---|
| `npm run pack` | `release/win-unpacked/`（動作確認用） |
| `npm run dist` | ポータブル ZIP |

ZIP には `.portable` と `.env.dist`（→ `.env` として同梱）が含まれます。

### 未署名 exe について

`npm run dist` で作る exe は**コード署名されていません**。Windows 11 で Smart App Control がオンだと起動できないことがあります。身内に渡すときは [docs/USER.md](docs/USER.md) の対処を共有してください。

## アーキテクチャ（概要）

1. `src/main/index.ts` が Electron を起動し Bot を同時起動
2. UI 操作は IPC 経由で `src/bot/services/voice-service.ts` を呼び出す
3. ミュートセッション中は `voiceStateUpdate` で参加・退出を監視
4. 設定は `electron-store`（`src/shared/config-store.ts`）

## ライセンス

MIT License — Copyright (c) 2026 oshiiiso

詳細は [LICENSE](LICENSE) を参照。
