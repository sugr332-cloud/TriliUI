import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../native/triliui-mobile-startup.js", import.meta.url), "utf8");

function fakeEnvironment({ mobile = true, layout = true, search = "" } = {}) {
    const store = new Map();
    const elements = new Map();
    const classSet = new Set(mobile ? ["mobile"] : ["desktop"]);
    const body = {
        classList: {
            contains: (value) => classSet.has(value),
            toggle(value, enabled) { if (enabled) classSet.add(value); else classSet.delete(value); }
        }
    };
    const nodes = [];
    function createElement(tag) {
        const node = {
            tag, id: "", type: "", textContent: "", attributes: {},
            setAttribute(k, v) { this.attributes[k] = v; },
            addEventListener(k, fn) { this.events[k] = fn; },
            events: {},
            click() { this.events.click?.(); }
        };
        nodes.push(node);
        return node;
    }

    const document = {
        body, documentElement: {},
        head: { appendChild(node) { elements.set(node.id, node); } },
        createElement,
        getElementById(id) { return elements.get(id) || null; }
    };
    if (layout) {
        for (const id of ["mobile-rest-container", "mobile-sidebar-wrapper", "detail-container", "launcher-pane"]) {
            const node = createElement("div");
            node.id = id;
            node.children = [];
            node.prepend = function(child) {
                this.children.unshift(child);
                elements.set(child.id, child);
            };
            elements.set(id, node);
        }
    }

    const window = {
        location: { search },
        localStorage: {
            getItem(key) { return store.get(key) ?? null; },
            setItem(key, value) { store.set(key, value); }
        },
        setTimeout() {}
    };
    let observer;
    class MutationObserver {
        constructor(callback) { this.callback = callback; observer = this; this.disconnected = false; }
        observe() { this.observing = true; }
        disconnect() { this.disconnected = true; }
    }
    const sandbox = { document, window, MutationObserver, URLSearchParams, console };
    return { run: () => vm.runInNewContext(source, sandbox), window, document, classSet, elements, store, getObserver: () => observer };
}

test("normal desktop layout is not changed", () => {
    const env = fakeEnvironment({ mobile: false });
    env.run();
    assert.equal(env.elements.has("triliui-fixed-tree-style"), false);
    assert.equal(env.classSet.has("triliui-fixed-tree"), false);
});

test("mobile layout enables persisted toggle and uses only native DOM", () => {
    const env = fakeEnvironment();
    env.run();
    assert.equal(env.classSet.has("triliui-fixed-tree"), true);
    const toggle = env.elements.get("triliui-fixed-tree-toggle");
    assert.equal(toggle.attributes["aria-pressed"], "true");
    assert.equal(env.elements.get("launcher-pane").children[0], toggle);
    assert.match(env.elements.get("triliui-fixed-tree-style").textContent, /#mobile-sidebar-wrapper/);
    toggle.click();
    assert.equal(env.classSet.has("triliui-fixed-tree"), false);
    assert.equal(toggle.attributes["aria-pressed"], "false");
    assert.equal(env.store.get("triliui.native.fixedTree.v1"), "off");
    toggle.click();
    assert.equal(env.classSet.has("triliui-fixed-tree"), true);
});

test("safe-mode URL bypasses stylesheet and startup", () => {
    const env = fakeEnvironment({ search: "?triliuiOff=1" });
    env.run();
    assert.equal(env.elements.has("triliui-fixed-tree-style"), false);
    assert.equal(env.window.__triliuiFixedTreeInitialized, undefined);
});

test("running the startup script twice is idempotent", () => {
    const env = fakeEnvironment();
    env.run();
    env.run();
    assert.equal(env.elements.get("launcher-pane").children.length, 1);
});

test("respects previously disabled state", () => {
    const env = fakeEnvironment();
    env.store.set("triliui.native.fixedTree.v1", "off");
    env.run();
    assert.equal(env.classSet.has("triliui-fixed-tree"), false);
});

test("missing DOM remains untouched until original layout appears", () => {
    const env = fakeEnvironment({ layout: false });
    env.run();
    assert.equal(env.elements.has("triliui-fixed-tree-style"), false);
    assert.equal(env.getObserver().observing, true);
    assert.equal(env.window.__triliuiFixedTreeInitialized, undefined);
});
