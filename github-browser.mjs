// Browser-side rendering gateway. This is NOT an iframe proxy for github.com.
import { chromium } from "playwright";

export function githubUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.hostname !== "github.com" || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

export function createGithubBrowser() {
  let browser, context, page;
  let busy = Promise.resolve();
  const serial = (fn) => {
    const p = busy.then(fn);
    busy = p.catch(() => {});
    return p;
  };
  async function ensure() {
    if (page && !page.isClosed()) return page;
    browser = await chromium.launch({ headless: true, args: ["--no-first-run"] });
    context = await browser.newContext({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 1, acceptDownloads: false });
    page = await context.newPage();
    // Prevent top-level navigation to other sites. No credentials from TriliUI
    // or the user's local browser are shared with this isolated Chromium.
    page.on("popup", async (p) => { await p.close().catch(() => {}); });
    await page.route("**/*", async route => {
      const req = route.request();
      if (req.isNavigationRequest() && req.frame() === page.mainFrame() && !githubUrl(req.url())) {
        return route.abort();
      }
      return route.continue();
    });
    await page.goto("https://github.com", { waitUntil: "domcontentloaded", timeout: 30000 });
    return page;
  }
  return {
    perform: (action, data = {}) => serial(async () => {
      const p = await ensure();
      switch (action) {
        case "navigate": {
          const target = githubUrl(data.url);
          if (!target) throw Object.assign(new Error("GitHub HTTPS URL only"), { status: 400 });
          await p.goto(target, { waitUntil: "domcontentloaded", timeout: 30000 });
          break;
        }
        case "click":
          if (!Number.isFinite(data.x) || !Number.isFinite(data.y)) throw Object.assign(new Error("Invalid coordinates"), { status: 400 });
          await p.mouse.click(data.x, data.y, { timeout: 5000 });
          break;
        case "scroll":
          if (!Number.isFinite(data.deltaY) || Math.abs(data.deltaY) > 3000) throw Object.assign(new Error("Invalid scroll"), { status: 400 });
          await p.mouse.wheel(0, data.deltaY);
          break;
        case "type":
          if (typeof data.text !== "string" || data.text.length > 2000) throw Object.assign(new Error("Invalid text"), { status: 400 });
          await p.keyboard.insertText(data.text);
          break;
        case "key":
          if (!["Enter","Tab","Escape","Backspace","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(data.key)) throw Object.assign(new Error("Invalid key"), { status: 400 });
          await p.keyboard.press(data.key);
          break;
        case "back": await p.goBack({ waitUntil: "domcontentloaded", timeout: 15000 }); break;
        case "forward": await p.goForward({ waitUntil: "domcontentloaded", timeout: 15000 }); break;
        case "capture": break;
        default: throw Object.assign(new Error("Unknown action"), { status: 400 });
      }
      const png = await p.screenshot({ type: "jpeg", quality: 65, timeout: 15000 });
      return { image: png.toString("base64"), url: githubUrl(p.url()) || "https://github.com", width: 1100, height: 800 };
    }),
    close: async () => { await browser?.close(); }
  };
}
