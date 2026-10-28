"use strict";

const tree = document.getElementById("tree");
const stage = document.getElementById("stage");
const titleEl = document.getElementById("current-title");
const statusEl = document.getElementById("connection");
const cache = new Map();
let config = null;
let currentId = null;
let selectedRow = null;

document.getElementById("width-toggle").addEventListener("click", () => {
  document.querySelector(".sidebar").classList.toggle("compact");
});

async function apiGet(path) {
  const response = await fetch(path, { credentials: "same-origin" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "HTTP " + response.status);
  return body;
}

function getNote(id) {
  if (!cache.has(id)) {
    const pending = apiGet("/api/notes/" + encodeURIComponent(id)).catch(error => {
      cache.delete(id);
      throw error;
    });
    cache.set(id, pending);
  }
  return cache.get(id);
}

function label(note, name) {
  return (note.attributes || []).find(a => a.name === name)?.value || "";
}

function safeUrl(raw) {
  try {
    const url = new URL(raw);
    if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) {
      return url.href;
    }
  } catch { /* invalid URL */ }
  return null;
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function actionLink(href, text, secondary = false) {
  const link = el("a", "action" + (secondary ? " secondary" : ""), text);
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function showError(message) {
  stage.replaceChildren(el("div", "intro error", message));
}

async function showNote(id, row) {
  const requestId = id;
  currentId = requestId;
  if (selectedRow) selectedRow.classList.remove("active");
  selectedRow = row;
  selectedRow.classList.add("active");
  titleEl.textContent = "読み込み中…";
  stage.replaceChildren(el("div", "intro", "読み込み中…"));
  try {
    const note = await getNote(id);
    if (currentId !== requestId) return;
    titleEl.textContent = note.title;
    const rawUrl = label(note, "triliUiUrl");
    const target = safeUrl(rawUrl);
    const mode = label(note, "triliUiMode") || "external";
    if (target) {
      renderExternal(note, target, mode);
    } else if (rawUrl) {
      showError("このノートの #triliUiUrl は無効です。http / https のみ設定できます。");
    } else {
      await renderNoteContent(note, requestId);
    }
  } catch (error) {
    if (currentId === requestId) showError("ノートを開けません: " + error.message);
  }
}

function renderExternal(note, target, mode) {
  const remote = safeUrl(config.remoteBrowserUrl);
  const header = el("div", "note");
  header.append(el("h1", "", note.title), el("p", "hint", target));
  const actions = el("div", "actions");
  actions.append(actionLink(target, "元のサイトを新しいタブで開く"));
  const copy = el("button", "action secondary", "URLをコピー");
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(target);
      copy.textContent = "コピーしました";
    } catch {
      copy.textContent = "コピーできません（HTTPSを確認）";
    }
  });
  actions.append(copy);
  header.append(actions);
  const message = el("p", "hint");
  if (mode === "remote") {
    if (!remote) {
      message.textContent = "リモートブラウザが未設定です。TRILIUI_REMOTE_BROWSER_URL を設定してください。";
      header.append(message);
      return stage.replaceChildren(header);
    }
    message.textContent = "下はリモートブラウザです。接続先ブラウザのURL欄で目的のサイトに移動してください。ノートURLは自動転送されません。";
    header.append(message);
    const shell = el("div", "frame-shell");
    const warning = el("div", "frame-warning", "リモートブラウザ表示：認証と接続先サーバーの iframe 許可が必要です。");
    const frame = el("iframe", "remote-frame");
    frame.title = "リモートブラウザ";
    frame.referrerPolicy = "no-referrer";
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups allow-downloads");
    frame.src = remote;
    shell.append(warning, frame);
    stage.replaceChildren(header, shell);
    return;
  }
  if (mode === "iframe") {
    message.textContent = "このサイトが埋め込みを許可する場合のみ下に表示できます。GitHub / ChatGPT は通常表示できません。";
    header.append(message);
    const frame = el("iframe", "remote-frame");
    frame.title = note.title;
    frame.referrerPolicy = "no-referrer";
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups");
    frame.src = target;
    stage.replaceChildren(header, frame);
    return;
  }
  message.textContent = "埋め込み不可サイトは右画面に直接表示できません。通常表示にはリモートブラウザ方式を設定してください。";
  header.append(message);
  stage.replaceChildren(header);
}

async function renderNoteContent(note, requestedId) {
  const container = el("div", "note");
  container.append(el("h1", "", note.title));
  if (note.isProtected) {
    container.append(el("p", "hint", "保護ノートはこの試作版では表示しません。"));
    return stage.replaceChildren(container);
  }
  if (!["text", "code"].includes(note.type)) {
    container.append(el("p", "hint", "このノート形式は試作版のプレビュー対象外です。"));
    return stage.replaceChildren(container);
  }
  try {
    const data = await apiGet("/api/notes/" + encodeURIComponent(note.noteId) + "/content");
    if (currentId !== requestedId) return;
    const body = note.type === "text" && note.mime?.includes("html")
      ? new DOMParser().parseFromString(data.content, "text/html").body.textContent
      : data.content;
    container.append(el("pre", "note-body", body || "（本文なし）"));
    container.append(el("p", "hint", "安全のため読み取り専用・文字プレビューです。編集は通常のTriliumで行ってください。"));
  } catch (err) {
    container.append(el("p", "error", "本文取得失敗: " + err.message));
  }
  stage.replaceChildren(container);
}

async function makeRow(note) {
  const holder = el("div", "tree-node");
  const row = el("div", "tree-row");
  const expand = el("button", "tree-expander", note.childNoteIds?.length ? "▸" : "·");
  expand.type = "button";
  expand.setAttribute("aria-label", note.title + " の子ノート");
  const title = el("button", "tree-title", note.title || "(無題)");
  title.type = "button";
  title.title = note.title;
  row.append(expand, title);
  holder.append(row);
  title.addEventListener("click", () => showNote(note.noteId, row));
  let expanded = false;
  let childrenLoaded = false;
  const children = el("div", "tree-children");
  children.hidden = true;
  holder.append(children);
  expand.addEventListener("click", async () => {
    if (!note.childNoteIds?.length) return;
    expanded = !expanded;
    expand.textContent = expanded ? "▾" : "▸";
    expand.setAttribute("aria-expanded", String(expanded));
    children.hidden = !expanded;
    if (expanded && !childrenLoaded) {
      children.replaceChildren(el("span", "hint", "読み込み中…"));
      try {
        const childNotes = await Promise.all(note.childNoteIds.map(id => getNote(id)));
        const items = await Promise.all(childNotes.map(makeRow));
        children.replaceChildren(...items);
        childrenLoaded = true;
      } catch (error) {
        children.replaceChildren(el("span", "error", "読み込み失敗"));
        expanded = false;
        children.hidden = true;
        expand.textContent = "▸";
      }
    }
  });
  return holder;
}

async function start() {
  try {
    config = await apiGet("/api/config");
    if (!config.configured) {
      statusEl.textContent = "未設定";
      return showError("サーバー側に TRILIUM_ETAPI_TOKEN を設定してください。トークンはブラウザへ送信しません。");
    }
    const root = await getNote(config.rootNoteId);
    const rootRow = await makeRow(root);
    tree.append(rootRow);
    statusEl.textContent = "Trilium 接続済み";
    const rootTitle = rootRow.querySelector(".tree-title");
    rootTitle.click();
    rootRow.querySelector(".tree-expander").click();
  } catch (error) {
    statusEl.textContent = "接続エラー";
    showError("Triliumとの接続に失敗しました: " + error.message);
  }
}

start();
