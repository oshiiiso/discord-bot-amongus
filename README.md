# AmongUs-Bot

Among Us用 VCサーバーミュート操作パネル（Electron + discord.js）

利用者向けの手順は [docs/USER.md](docs/USER.md) を参照。

## 機能概要

- VC全員のサーバーミュート / 解除（ミュートセッション対応）
- VCプリセット・グローバルショートカット・トレイ常駐
- ポータブル配布対応（`.portable` マーカーでルート配下に設定・ログを保存）

## ディレクトリ構成

```
src/main/           # Electronメインプロセス
src/bot/            # Discord Bot
src/shared/         # 共通型・設定・パス解決
ui/                 # 操作パネル・設定画面
assets/             # トレイアイコンなど
docs/USER.md        # 利用者向けガイド
data/               # ポータブル時の設定（.gitignore）
logs/               # ログ（.gitignore）
release/            # ビルド出力（.gitignore）
```

## 開発環境セットアップ

```powershell
npm install
copy .env.example .env   # 任意
npm start
```

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
| `PORTABLE` | `1` でポータブルモード強制 | — |

### ポータブルモード

以下のいずれかで有効化。設定・ログはアプリルート直下に保存される。

- ルートに `.portable` ファイルがある
- 環境変数 `PORTABLE=1`

```
AmongUs-Bot/
  AmongUs-Bot.exe
  .portable
  data/config.json
  logs/
  .env              # 任意
```

開発時はプロジェクトルートの `.portable` により同じ挙動になる。

## ビルド

```powershell
# ポータブル版（ZIP。 .portable 同梱）
npm run dist:portable

# インストーラー版（設定は %APPDATA%）
npm run dist:installer
```

| コマンド | 出力 |
|---|---|
| `npm run pack` | `release/win-unpacked/`（未圧縮） |
| `npm run dist:portable` | `release/AmongUs-Bot-x.x.x-win.zip` |
| `npm run dist:installer` | `release/AmongUs-Bot Setup x.x.x.exe` |

## アーキテクチャ（概要）

1. `src/main/index.ts` がElectronを起動しBotを同時起動
2. UI操作はIPC経由で `src/bot/services/voice-service.ts` を呼び出す
3. ミュートセッション中は `voiceStateUpdate` で参加・退出を監視
4. 設定は `electron-store`（`src/shared/config-store.ts`）

## ライセンス

MIT
