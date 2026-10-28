# TriliUI Phase 1 — Trilium 本体内の Android 固定ナビゲーション（PoC）

## 目的

Trilium のブラウザ版を Android で開いたとき、通常はノートツリー（モバイルのナビゲーター）とノート本文が画面切り替え式です。**左にナビゲーター、右に元の Trilium ノート編集画面**が同時表示されるようにします。

**この方式は別サーバー／Chrome 拡張／ETAPI 不要です。** Trilium が公式にサポートする JS (frontend) スクリプト + `#run=mobileStartup` を利用します。

この Phase 1 の「ツリー」は厳密には **Trilium モバイル標準の階層ナビゲーター**で、デスクトップの展開可能な複数階層ツリー（Fancytree）ではありません。モバイル側はフォルダーをタップして階層を移動します。

## インストール（スマホでもできるが、初回はPC推奨）

1. **Trilium のバックアップを作成**し、既存のノート・編集機能を触らないことを確認。
2. Trilium 内に通常の子ノートを作成。ノート名を `TriliUI Mobile Startup` にする。
3. ノート種類を **Code** にし、言語を **JS (frontend)** にする。**JS (backend) は選ばない**。
4. このリポジトリの [triliui-mobile-startup.js](triliui-mobile-startup.js) の全内容を Code ノートに貼り付ける。
5. ノートの「属性 (Attributes)」から **ラベル `run` / 値 `mobileStartup`** を追加する（表示上は `#run=mobileStartup`）。
6. Android Chrome で Trilium を開き直す。スマホ版にならない場合は Trilium のグローバルメニューからモバイル版に切り替え（またはログイン時 `?mobile`）。
7. 画面下のランチャー列に現れる **☷** ボタンで左ナビゲーションの固定を ON / OFF にする。初期値は ON。

**重要：スクリプトが追加されただけでは、GitHub / ChatGPT のページは埋め込まれません。** 本フェーズはノートツリー／通常の本文編集の並置のみを対象にしています。

## 画面の挙動

| 操作 | 期待値 |
|---|---|
| Androidでノートを選ぶ | 左ナビゲーターを残し、右側で通常のノートを表示 |
| 右側の本文を編集 | Trilium 標準の編集機能がそのまま動作 |
| 左側でフォルダーをタップ | その階層の子ノート一覧へ移動 |
| ☷ ボタンを押す | 左固定 ON/OFF、端末内のブラウザに設定保存 |
| Chrome PCの通常デスクトップUI | 何も変更しない |
| Android 横画面 / 幅 992px 以上 | Trilium の標準タブレットレイアウトを維持 |

幅が 991px 以下の場合、左側の幅は `clamp(112px, 34vw, 180px)` です。小さなスマホでは右側が狭くなるため、コードエディターや表の編集時には ☷ で解除して使用してください。

## 元に戻す方法 / トラブル回避

- 画面下の **☷** で OFF にする（設定はブラウザ内の localStorage に保存）
- スクリプト自体を止めたい場合は、Code ノートの `#run=mobileStartup` 属性を削除してブラウザを再読み込み
- 画面が操作できない場合、ログイン済みのTrilium URLに `?triliuiOff=1` を付けて開き直す（元のクエリがある場合は `&triliuiOff=1`）。スクリプトの UI 変更をスキップする
- トラブル時は Trilium標準UIに戻し、`#run` を外す。Trilium のデータベースやノート本文を自動変更する機能はない

注：`?triliuiOff=1` は TriliUI スクリプトだけの緊急停止指定であり、Trilium 公式のURLパラメーターではありません。

## 制約とリスク

- **Trilium 内部のDOM ID（`mobile-rest-container`, `mobile-sidebar-wrapper`, `detail-container`, `launcher-pane`）とCSSセレクタを利用**。これらは公開APIではなく、今後のTrilium更新で変更される可能性があります。
- 現時点では upstream の **2026年10月時点の main ブランチ** のレイアウト構造を参照しているだけです。利用者のTriliumバージョンとの適合は未検証です。
- 狭い画面でエディタ、モーダル、キーボード、ドラッグ操作の干渉が起こる可能性があります。
- JSのリモート読み込みやAPIキーの保持は行いません。トークン不要。
- 正式な Trilium プラグイン配布ファイル（.zip）は未作成。現時点ではコードノートへ手動貼り付け方式。
- GitHub や ChatGPT は iframe を制限しています。**ブラウザ版で直接埋め込んで操作する問題は未解決**です。Phase 2 でリモートブラウザ方式の実機検証を行います。

## Phase 1 受け入れ試験（実機でチェックする）

- [ ] Android Chrome に Trilium でログインし、自動で mobile UI になる
- [ ] 画面下に ☷ ボタンが出る
- [ ] ☷ ON で左ナビゲーターと右ノート編集画面が同時表示
- [ ] AIO 等の子ノートを選んでもナビゲーターが消えない
- [ ] 通常ノートで日本語入力、保存、画像表示ができる
- [ ] 編集中にソフトウェアキーボードが出ても意図せぬスクロール・タップがない
- [ ] ☷ OFF と緊急停止URLで標準表示へ復帰できる
- [ ] PCデスクトップレイアウトが変化しない
- [ ] 他のノート種類（表、PDF、Web View）を選んでも操作不能にならない

## 開発参照（2026-10-28 確認）

- [Trilium 公式 Mobile Frontend](https://docs.triliumnotes.org/user-guide/setup/mobile-frontend)
- [Trilium 公式 frontend scripts](https://docs.triliumnotes.org/user-guide/scripts/frontend-basics)
- [Trilium mobile_layout.tsx](https://github.com/TriliumNext/Trilium/blob/main/apps/client/src/layouts/mobile_layout.tsx)
- [Trilium sidebar_container.ts](https://github.com/TriliumNext/Trilium/blob/main/apps/client/src/widgets/mobile_widgets/sidebar_container.ts)
- [Trilium style.css](https://github.com/TriliumNext/Trilium/blob/main/apps/client/src/stylesheets/style.css)
- [Trilium MobileNoteNavigator.tsx](https://github.com/TriliumNext/Trilium/blob/main/apps/client/src/widgets/mobile_widgets/MobileNoteNavigator.tsx)
