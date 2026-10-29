# GitHub右ペイン操作 PoC (Phase X01-A)
## 動作
TriliUI Phase 0コンパニオンUIでノートの `#triliUiUrl="https://github.com/owner/repo"` と `#triliUiMode=remote` を付けると、右側にPlaywrightの別プロセスChromiumが取得したGitHubの画面をJPEGで表示。クリック（画像上の位置）、スクロール、文字入力、Enter/Tab/Backspace、戻る・進む・URL移動をリモートブラウザへ送る。左ノートツリーは維持。初期状態ではGitHub HTTPSホストに限定し、別ドメインへのトップレベル遷移を禁止する。GitHubのiframe制限は解除しない。

## 起動・手動確認
```bash
git switch feat/github-remote-browser
npm install
npx playwright install chromium
# Linuxで依存ライブラリが足りない場合はOSの案内に従い導入
# 環境変数 TRILIUM_ETAPI_TOKEN と TRILIUM_BASE_URL を設定
npm test
npm start
```
Bazzite等でPlaywright Chromiumとシステム依存パッケージの動作を確認。画面を開き、通常テキストノートに属性を追加:
```
#triliUiUrl="https://github.com/sugr332-cloud/TriliUI"
#triliUiMode=remote
```
左ツリーから選択→右側にGitHub画面→リンクをクリック→スクロール→URLを編集して移動→戻る/進むの順に実機確認。PC ChromeとAndroid Chromeで同じ試験を行う。ブラウザ側にGitHubログイン済みでも、サーバーChromium側のログインとは共有されない。認証が必要な操作は専用ブラウザ内で行うが、現段階では**GitHubログインを推奨しない**。データ永続化・強固なアクセス分離が未実装のため。

## セキュリティと制限（運用前に必読）
- これは**単一利用者の開発用PoC**。全クライアントでChromiumセッションが1つ共有される。複数ユーザーに公開しない。
- `TRILIUI_BIND` はデフォルト127.0.0.1。ネットワーク公開する前に認証付きHTTPSリバースプロキシとアクセス制限を必須にする。TriliUI自体のログイン機能はない。
- TriliumのETAPIトークン、リモートブラウザCookie、ユーザーのローカルChromeログイン情報は相互に引き渡さない。
- GitHubのログイン、2FA、PRへの書込み操作、ファイルアップロード、ダウンロード、Ctrl系ショートカット、クリップボードは実機未検証/未対応。ブラウザページの変化によってクリックの直後のスクリーンショットが古く見える場合は「更新」を押す。
- 安全上、GitHub以外のサイトへのトップレベル遷移は拒否。外部リンクは扱わない。iframe直接表示やヘッダーの無効化は行わない。
- 観測済みのGitHub接続・Android実機動作ではない。CIやモックテストだけでは実装完了にならない。

## 次の必須作業
X01-B: 利用者別のセッション認証/CSRF/ログイン情報保護/操作監査/アイドルタイムアウト/スクリーンショットのレート制限。
X01-C: Phase 1 ネイティブ Trilium用右ペイン統合（現在のPhase 1コードには組み込まれていない）。Trilium DOMへの表示はバージョン固定・復旧可能な拡張が必要。
X01-D: Android実機でタップ/キーボード/スワイプ/テキスト選択/認証/PR画面を検証、失敗時の安全停止。

## 技術
`github-browser.mjs` Playwright Chromium; `POST /api/github/browser` 同一オリジンJSON; `public/github-viewer.js` 描画操作; `public/app.js` でremote+github.comノートを切替。ビューは1100x800を基準としてクリック座標を変換。Playwright Chromiumの起動は最初の操作時に発生する。
