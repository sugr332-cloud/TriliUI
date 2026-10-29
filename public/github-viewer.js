"use strict";
// Right-pane screenshot viewer: GitHub is rendered by an isolated server-side Chromium.
window.renderGithubViewer = function renderGithubViewer(stage, target) {
  const panel = document.createElement("section");
  panel.className = "github-viewer";
  const bar = document.createElement("div");
  bar.className = "github-controls";
  const url = document.createElement("input");
  url.type = "url"; url.value = target; url.setAttribute("aria-label", "GitHub URL");
  url.placeholder = "https://github.com/owner/repo";
  const button = (label, action) => {
    const b = document.createElement("button");
    b.textContent = label; b.type = "button"; b.addEventListener("click", action);
    bar.appendChild(b); return b;
  };
  const status = document.createElement("span"); status.setAttribute("role", "status");
  const screen = document.createElement("img");
  screen.alt = "リモートChromiumのGitHub画面";
  screen.style.cssText = "display:block;max-width:100%;height:auto;touch-action:pan-y;";
  const text = document.createElement("input");
  text.placeholder = "文字入力（送信するとリモート画面へ入力）";
  text.setAttribute("aria-label", "リモートブラウザへ文字入力");
  let active = true;
  async function send(action, extra = {}) {
    if (!active) return;
    status.textContent = "通信中…";
    try {
      const res = await fetch("/api/github/browser", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra })
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || res.statusText);
      if (!active) return;
      screen.src = "data:image/jpeg;base64," + out.image;
      url.value = out.url;
      status.textContent = "接続済み";
    } catch (err) { if (active) status.textContent = "エラー: " + err.message; }
  }
  button("戻る", () => send("back"));
  button("進む", () => send("forward"));
  button("更新", () => send("capture"));
  bar.appendChild(url);
  button("移動", () => send("navigate", { url: url.value }));
  const tools = document.createElement("div");
  tools.className = "github-controls";
  const add = (label, handler) => { const b=document.createElement("button"); b.type="button"; b.textContent=label; b.onclick=handler; tools.append(b); };
  add("上へ", () => send("scroll",{deltaY:-570}));
  add("下へ", () => send("scroll",{deltaY:570}));
  tools.appendChild(text);
  add("入力", () => { const value=text.value; text.value=""; send("type",{text:value}); });
  add("Enter", () => send("key",{key:"Enter"}));
  add("Tab", () => send("key",{key:"Tab"}));
  add("Backspace", () => send("key",{key:"Backspace"}));
  screen.addEventListener("click", e => {
    const rect=screen.getBoundingClientRect();
    send("click",{x:Math.floor((e.clientX-rect.left)*1100/rect.width),y:Math.floor((e.clientY-rect.top)*800/rect.height)});
  });
  panel.append(bar, tools, status, screen);
  stage.replaceChildren(panel);
  const observer = new MutationObserver(() => {
    if (!stage.contains(panel)) { active=false; observer.disconnect(); }
  });
  observer.observe(stage, {childList:true});
  send("navigate",{url:target});
};