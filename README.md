# TriliUI

**PC（Chrome / Firefox など）と Android の通常ブラウザで使える、Trilium Notes 用の固定ツリー付きコンパニオン Web UI。**

開発ステータス: **v0.1 / Phase 0 試作**。リポジトリが空の状態から作成した新規プロジェクトです。**現時点で Trilium の正式なプラグインとしてインストールできるわけではありません**。Trilium 本体のノートツリーを読み取り、専用 UI に再表示する方式です。

## 目的と、現時点でできること

- 左側に Trilium のノート階層を **常時表示**（Android の狭い画面でも縮小表示）
- 右側で選択ノートの文字プレビュー、外部 URL のリンクを表示
- Trilium ETAPI により PC と Android で同じデータを参照
- 元ノートに `#triliUiUrl` を登録して GitHub / ChatGPT / 任意サイトを紐付け
- サイトが iframe を許可する場合は埋め込みが可能
- **リモートブラウザ**の URL を別途設定できれば、GitHub / ChatGPT を右側の領域で操作するための iframe 受け口を表示

**まだできないこと:**
- GitHub / ChatGPT の Web UI を直接 iframe に埋め込むこと（サイトの X-Frame-Options / CSP 制限）
- リモートブラウザを自動構築すること、ノートをクリックしてリモートブラウザのURLを自動遷移させること
- ノート本文の編集や Trilium の全ノート形式の完全表示（v0.1 は読み取り専用の文字プレビュー）
- Trilium 本体のデスクトップ UI / Android の内蔵モバイル UI を置換すること
- **追加サーバー無しで**元の GitHub / ChatGPT ページをツリーと同じ画面に表示すること

## 1. セットアップ（Bazzite Linux / Node.js 20+）

Trilium サーバーが稼働していることが前提です。Trilium → **Options → ETAPI** からトークンを発行します。

```bash
git clone https://github.com/sugr332-cloud/TriliUI.git
cd TriliUI
cp .env.example .env
# .env の TRILIUM_BASE_URL と TRILIUM_ETAPI_TOKEN を編集
set -a
. ./.env
set +a
npm start
```

PC のブラウザで `http://127.0.0.1:8787` を開きます。起動ログに接続先が表示されます。

- `TRILIUM_BASE_URL` は **TriliUIサーバーから接続できるTrilium URL**（初期値 http://127.0.0.1:8080）
- `TRILIUM_ETAPI_TOKEN` は Trilium の ETAPI 認証トークン。**絶対に GitHub にコミットしないこと**
- `TRILIUI_ROOT_NOTE_ID=root` は全体ツリーを表示。特定フォルダーに限定するなら該当ノート ID
- データは読み取り専用。Trilium のノートを改変・削除しません。

## 2. Android から開く

Android Chrome は PC 用 Chrome 拡張機能をインストールできません。TriliUI は通常の HTTPS Web ページなので Android Chrome から開けます。

デフォルトでは安全のため **127.0.0.1 にしか接続できません**。Android から使う場合は、既存の Tailscale 環境などで **認証済み HTTPS リバースプロキシ**を `127.0.0.1:8787` に接続してください。例えば Tailscale Serve を使う構成です。公開インターネットへの直接転送は禁止です。接続設定は Tailscale バージョンごとに確認してください。

この UI は Trilium の認証をそのまま引き継ぐものではなく、ETAPI トークンを持つサーバーがノートを提供します。そのため、**TriliUI URL を他人に公開するとノートが読めてしまいます**。ネットワーク制限または認証が必須です。

## 3. 外部サイトを子ノートとして登録する

例: 「HoB → GitHub → AioSite」というテキストノートを作成し、Trilium の属性からラベルを付けます。

```text
#triliUiUrl="https://github.com/sugr332-cloud/AioSite"
```

デフォルトでは **「元のサイトを新しいタブで開く」** ボタンが表示されます。GitHub 自体の iframe は表示しません。

### 表示方式の選択

| ラベル | 意味 | 条件 |
|---|---|---|
| `#triliUiMode=external` | 元のサイトへリンク（既定） | 追加構成不要 |
| `#triliUiMode=iframe` | 右側にサイト直接埋め込み | サイトが iframe を許可する場合のみ |
| `#triliUiMode=remote` | 右側にリモートブラウザを表示 | 保護されたブラウザ配信サービスが別途必要 |

`remote` の場合はサーバー側で `TRILIUI_REMOTE_BROWSER_URL` を設定します。これは **GitHub の URL ではなく、リモートブラウザの画面配信 URL** です。接続先の frame-ancestors 設定、TLS、認証が必要です。

```text
#triliUiUrl="https://chatgpt.com/"
#triliUiMode=remote
```

※ この段階では remote ノートに切り替えてもリモート Chromium が指定 URL に自動移動しません。リモートブラウザ内部のURL欄で開いてください。自動遷移は次フェーズで、ブラウザ制御APIの認証設計とともに対応する予定です。

## 4. セキュリティ設計

1. ETAPI トークンは Node サーバーの環境変数に保管し、ブラウザ JavaScript に配布しない。
2. ETAPI の代理アクセスは固定の **GET ノート・本文** エンドポイントのみ。任意の API URL、更新 API は中継しない。
3. 出力 HTML は本文として直接描画せず、文字テキストとして無害化して表示する。
4. 外部 URL は http / https のみ許可。クリック時は `noopener noreferrer`。
5. API 応答に `no-store`、コンテンツセキュリティポリシーを設定。
6. TriliUI とリモートブラウザの各々にアクセス制限を掛ける。Cookie・GitHub 認証情報を TriliUI に渡さない。
7. Trilium の保護ノートは本文プレビューを拒否。

注意: **TriliUIサーバー自体にはログイン機構がありません**。ローカルホスト以外から公開する場合は必ず HTTPS と認証のある手前のリバースプロキシを使い、利用者を制限すること。

## 5. 開発フェーズ

| フェーズ | 内容 | 状態 |
|---|---|---|
| 0 | ETAPI 接続、左固定ツリー、読取プレビュー、URLラベル、Android CSS | 試作実装 |
| 1 | ブラウザ実機試験、ツリー検索、UI日本語、タッチ操作、保護ノート、エラー処理 | 未実施 |
| 2 | リモート Chromium/Webtop 配備手順、HTTPS/認証、Android描画試験 | 未実施 |
| 3 | ノートからのブラウザURL切替、戻る/進む、複数セッション管理 | 未実施 |
| 4 | Trilium本体との統合・編集機能・PWA化、リグレッションテスト | 未実施 |

### 受け入れ確認

- Linux の Chrome から URL を開くと、左側ツリーが固定される
- Android Chrome から URL を開いてもツリーが消えず、右側だけが変わる
- `AioSite` ノートに URL を付けると、対応リンクが表示される
- iframe 制限のある GitHub / ChatGPT は**不正な回避をしない**
- ETAPI トークンが HTTP 応答・JS のいずれにも出力されない
- ネットワークを切断した場合は UI にエラーを表示し、誤って別のノートを表示しない
- リモートブラウザを利用する場合は、端末別のログイン・タッチ入力・通信再接続を別途検証

## 開発・テスト

```bash
npm test
node --check server.mjs
node --check public/app.js
```

Node.js 標準ライブラリのみで動作します（npm パッケージの追加インストールは不要）。

## 参考資料

- [Trilium ETAPI](https://docs.triliumnotes.org/user-guide/advanced-usage/etapi)
- [Trilium Web View の制約](https://docs.triliumnotes.org/user-guide/note-types/webview)
- [Trilium モバイルフロントエンド](https://docs.triliumnotes.org/user-guide/setup/mobile-frontend)
