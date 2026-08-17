# AmongUs-Bot

Among Us用 VCサーバーミュート操作パネル（Electron + discord.js）

**配布形式: ポータブル ZIP のみ**（解凍して `AmongUs-Bot.exe` を起動）

- リポジトリ: https://github.com/oshiiiso/discord-bot-amongus
- 不具合・要望: [Issues](https://github.com/oshiiiso/discord-bot-amongus/issues)
- ダウンロード: [Releases](https://github.com/oshiiiso/discord-bot-amongus/releases)

利用者向けの手順は [docs/USER.md](docs/USER.md) を参照。

## 機能概要

- VC全員のサーバーミュート / 解除（ミュートセッション対応）
- VCプリセット・グローバルショートカット・トレイ常駐
- ポータブル配布（設定・ログは exe と同じフォルダに保存）
- ヘルプ・問い合わせ・アップデート通知

## ディレクトリ構成

```
src/main/           # Electronメインプロセス
src/bot/            # Discord Bot
src/shared/         # 共通型・設定・パス解決
ui/                 # 操作パネル・設定画面
assets/             # トレイアイコンなど
docs/USER.md        # 利用者向けガイド
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

開発時は `.env.dist` の公開設定が読み込まれ、`.env` で上書きできます。設定・ログは常にプロジェクトルートの `data/` / `logs/` に保存されます（配布版と同じ挙動）。

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
| `SUPPORT_EMAIL` | 問い合わせ先メール（配布 ZIP 同梱用） | — |
| `ISSUES_URL` | 問い合わせ先 Issue URL | — |
| `GITHUB_OWNER` | アップデート通知用 GitHub オーナー | — |
| `GITHUB_REPO` | アップデート通知用リポジトリ名 | — |
| `UPDATE_FEED_URL` | カスタム更新フィード URL（`GITHUB_*` の代わり） | — |
| `USER_GUIDE_PATH` | ヘルプ表示用 Markdown のパス | `docs/USER.md` |

`.env` は Git に含めない。配布 ZIP には公開情報のみ入れる（Bot トークンはアプリ内設定）。

### ポータブル版のフォルダ構成

配布 ZIP を解凍すると、おおよそ次の構成になる。

```
AmongUs-Bot/
  AmongUs-Bot.exe
  .portable              # ポータブル配布のマーカー（同梱・削除しない）
  .env                   # 問い合わせ先・アップデート設定（配布時に同梱）
  data/config.json       # 初回起動後に作成（Botトークン・VC設定）
  logs/                  # 初回起動後に作成
  resources/
  ...
```

設定・ログはすべて exe と同じフォルダ配下に保存される。フォルダごとコピーすれば設定も引き継げる。

## ビルド（配布用 ZIP）

```powershell
npm run dist
```

`.portable` と `.env.dist`（→ `.env` として同梱）が ZIP に含まれる。

| コマンド | 出力 |
|---|---|
| `npm run pack` | `release/win-unpacked/`（ZIP 化前の確認用） |
| `npm run dist` | `release/AmongUs-Bot-x.x.x-win.zip` |

配布用の公開設定は `.env.dist` を編集する。GitHub Releases にアップロードするとアップデート通知が有効になる。

## アーキテクチャ（概要）

1. `src/main/index.ts` が Electron を起動し Bot を同時起動
2. UI 操作は IPC 経由で `src/bot/services/voice-service.ts` を呼び出す
3. ミュートセッション中は `voiceStateUpdate` で参加・退出を監視
4. 設定は `electron-store`（`src/shared/config-store.ts`）

## ライセンス

MIT License — Copyright (c) 2026 oshiiiso

詳細は [LICENSE](LICENSE) を参照。
