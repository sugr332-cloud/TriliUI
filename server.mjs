import { createServer } from "node:http";
import { createGithubBrowser } from "./github-browser.mjs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.TRILIUI_PORT || 8787);
const BIND = process.env.TRILIUI_BIND || "127.0.0.1";
const ETAPI_BASE = (process.env.TRILIUM_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const ETAPI_TOKEN = process.env.TRILIUM_ETAPI_TOKEN || "";
const ROOT_ID = process.env.TRILIUI_ROOT_NOTE_ID || "root";
const githubBrowser = createGithubBrowser();
const NOTE_ID = /^(?:root|[a-zA-Z0-9_]{4,32})$/;
const STATIC = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/github-viewer.js", ["github-viewer.js", "text/javascript; charset=utf-8"]],
  ["/style.css", ["style.css", "text/css; charset=utf-8"]],
]);

function safeHttpUrl(input) {
  if (!input) return null;
  try {
    const u = new URL(input);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    return u.href;
  } catch {
    return null;
  }
}

function reply(res, status, data, type = "application/json; charset=utf-8") {
  const body = typeof data === "string" ? data : JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": type,
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src http: https:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  });
  res.end(body);
}

async function fromTrilium(endpoint) {
  if (!ETAPI_TOKEN) throw new Error("TRILIUM_ETAPI_TOKEN is not configured");
  const r = await fetch(ETAPI_BASE + "/etapi" + endpoint, {
    headers: { Authorization: ETAPI_TOKEN },
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
  if (!r.ok) {
    const err = new Error("Trilium ETAPI returned " + r.status);
    err.status = r.status === 404 ? 404 : 502;
    throw err;
  }
  if (Number(r.headers.get("content-length")) > 2 * 1024 * 1024) {
    const err = new Error("Note content exceeds 2 MiB limit");
    err.status = 413;
    throw err;
  }
  const data = await r.text();
  if (data.length > 2 * 1024 * 1024) {
    const err = new Error("Note content exceeds 2 MiB limit");
    err.status = 413;
    throw err;
  }
  return data;
}

export function makeHandler() {
  return async (req, res) => {
    if (req.url === "/api/github/browser" && req.method === "POST") {
      const origin = req.headers.origin;
      const host = req.headers.host;
      if (!origin || new URL(origin).host !== host ||
          !req.headers["content-type"]?.startsWith("application/json")) {
        return reply(res, 403, { error: "Origin and JSON required" });
      }
      let input = "";
      for await (const chunk of req) {
        input += chunk.toString();
        if (input.length > 8192) return reply(res, 413, { error: "Request too large" });
      }
      try {
        const data = JSON.parse(input);
        const out = await githubBrowser.perform(data.action, data);
        return reply(res, 200, out);
      } catch (e) {
        return reply(res, e.status || 502, { error: e.message });
      }
    }
    if (req.method !== "GET") return reply(res, 405, { error: "GET only" });
    let path;
    try {
      path = new URL(req.url, "http://localhost").pathname;
    } catch {
      return reply(res, 400, { error: "Invalid URL" });
    }
    try {
      if (STATIC.has(path)) {
        const [file, mime] = STATIC.get(path);
        const body = await readFile(join(HERE, "public", file), "utf8");
        return reply(res, 200, body, mime);
      }
      if (path === "/api/config") {
        return reply(res, 200, {
          rootNoteId: ROOT_ID,
          remoteBrowserUrl: safeHttpUrl(process.env.TRILIUI_REMOTE_BROWSER_URL),
          triliumWebUrl: safeHttpUrl(process.env.TRILIUM_WEB_URL),
          configured: Boolean(ETAPI_TOKEN),
        });
      }
      const match = /^\/api\/notes\/(root|[A-Za-z0-9_]{4,32})(\/content)?$/.exec(path);
      if (match && NOTE_ID.test(match[1])) {
        const id = match[1];
        const isContent = Boolean(match[2]);
        if (isContent) {
          const source = await fromTrilium("/notes/" + id + "/content");
          return reply(res, 200, { noteId: id, content: source });
        }
        const note = JSON.parse(await fromTrilium("/notes/" + id));
        return reply(res, 200, {
          noteId: note.noteId,
          title: note.title,
          type: note.type,
          mime: note.mime,
          isProtected: Boolean(note.isProtected),
          childNoteIds: Array.isArray(note.childNoteIds) ? note.childNoteIds : [],
          attributes: (note.attributes || [])
            .filter(a => a.type === "label" && ["triliUiUrl", "triliUiMode"].includes(a.name))
            .map(a => ({ name: a.name, value: a.value })),
        });
      }
      reply(res, 404, { error: "Not found" });
    } catch (e) {
      const status = e.status || 502;
      reply(res, status, { error: status === 502 ? "Unable to read Trilium ETAPI" : e.message });
    }
  };
}

if (process.env.NODE_ENV !== "test") {
  createServer(makeHandler()).listen(PORT, BIND, () => {
    console.log("TriliUI listening on http://" + BIND + ":" + PORT);
    if (BIND !== "127.0.0.1" && BIND !== "::1") {
      console.warn("WARNING: Bind is not loopback. Put authentication/TLS in front before exposing it.");
    }
  });
}
