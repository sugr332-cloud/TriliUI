# TriliUI

Trilium Notes の **左ナビゲーションを残したままノート本文を表示・編集する**ための、PC・Androidブラウザ対応を目指すプロジェクトです。

## 現在の開発状況

### Phase 1 — Trilium本体内のAndroid用固定ナビゲーション（試作）

- **[導入手順・解除方法・実機テスト項目](native/README.md)**
- **[Trilium JS (frontend) 起動スクリプト](native/triliui-mobile-startup.js)**
- 配布方式は Trilium 内にコードノートを作り、`#run=mobileStartup` を付けるもの。ブラウザ拡張のインストールや追加サーバーは不要。
- Androidで左ナビゲーターと右側のノート編集画面を並べ、画面下の ☷ から ON/OFF。
- **Trilium本体でのAndroid実機試験は未実施**。導入前にバックアップを推奨。

### Phase 0 — 外部コンパニオンWeb UI（別案）

別ブランチの [PR #1](https://github.com/sugr332-cloud/TriliUI/pull/1) に、ETAPI経由で独立表示する方式の試作があります。Phase 1とは**別方式**で、並行して評価するため現在はマージしていません。

## GitHub / ChatGPT の埋め込みについて

Trilium ブラウザ版の iframe では、GitHub / ChatGPT の元画面を直接表示・操作することはできません。この制限は TriliUI Phase 1 でも解消されていません。将来は保護されたリモートブラウザ連携（Phase 2）で対応を検討します。危険なヘッダー削除やCookie転送での回避は行いません。

## 開発の進め方

1. Phase 1スクリプトの構文・モックテスト
2. Android ChromeおよびBazzite Chromeでの実機確認
3. 使い勝手・キーボード・狭い表示幅の修正
4. レビュー後にマージ
5. Phase 2: GitHub / ChatGPT の実画面を表示するための別途安全なブラウザ配信設計
