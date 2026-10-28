import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

let upstream;
let app;
let base;

before(async () => {
  upstream = createServer((req, res) => {
    assert.equal(req.headers.authorization, "TEST_ETAPI_TOKEN");
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/etapi/notes/root") {
      return res.end(JSON.stringify({
        noteId: "root", title: "My notes", type: "text", mime: "text/html",
        attributes: [], childNoteIds: ["ABCD1234"],
      }));
    }
    if (req.url === "/etapi/notes/ABCD1234") {
      return res.end(JSON.stringify({
        noteId: "ABCD1234", title: "GitHub", type: "text", mime: "text/html",
        childNoteIds: [], attributes: [
          { type: "label", name: "triliUiUrl", value: "https://github.com" },
          { type: "label", name: "privateData", value: "NOT_EXPOSED" },
        ],
      }));
    }
    if (req.url === "/etapi/notes/root/content") return res.end("<p>Hello</p>");
    res.statusCode = 404;
    res.end("{}");
  });
  await new Promise(resolve => upstream.listen(0, "127.0.0.1", resolve));
  process.env.NODE_ENV = "test";
  process.env.TRILIUM_BASE_URL = "http://127.0.0.1:" + upstream.address().port;
  process.env.TRILIUM_ETAPI_TOKEN = "TEST_ETAPI_TOKEN";
  const { makeHandler } = await import("../server.mjs");
  app = createServer(makeHandler());
  await new Promise(resolve => app.listen(0, "127.0.0.1", resolve));
  base = "http://127.0.0.1:" + app.address().port;
});

after(async () => {
  if (app) await new Promise(resolve => app.close(resolve));
  if (upstream) await new Promise(resolve => upstream.close(resolve));
});

test("ETAPI credentials stay server side", async () => {
  const response = await fetch(base + "/api/config");
  const text = await response.text();
  assert.equal(response.status, 200);
  assert.equal(text.includes("TEST_ETAPI_TOKEN"), false);
  assert.equal(JSON.parse(text).rootNoteId, "root");
});

test("read-only note hierarchy and whitelisted labels", async () => {
  const root = await (await fetch(base + "/api/notes/root")).json();
  assert.deepEqual(root.childNoteIds, ["ABCD1234"]);
  const child = await (await fetch(base + "/api/notes/ABCD1234")).json();
  assert.equal(child.title, "GitHub");
  assert.equal(child.attributes.length, 1);
  assert.equal(child.attributes[0].name, "triliUiUrl");
});

test("note content can be read but not modified", async () => {
  const data = await (await fetch(base + "/api/notes/root/content")).json();
  assert.equal(data.content, "<p>Hello</p>");
  const post = await fetch(base + "/api/notes/root", { method: "POST" });
  assert.equal(post.status, 405);
});

test("rejects invalid note identifiers and paths", async () => {
  const r = await fetch(base + "/api/notes/invalid-id");
  assert.equal(r.status, 404);
  const r2 = await fetch(base + "/api/no-such-endpoint");
  assert.equal(r2.status, 404);
});

test("app loads and enforces no-store responses", async () => {
  const r = await fetch(base + "/");
  assert.equal(r.status, 200);
  assert.match(await r.text(), /TriliUI/);
  assert.equal(r.headers.get("cache-control"), "no-store");
});
