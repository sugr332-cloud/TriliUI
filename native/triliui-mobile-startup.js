/*
 * TriliUI Phase 1 — native Trilium mobile frontend enhancement.
 *
 * Install this complete file as a "JS (frontend)" Code note in Trilium.
 * Add #run=mobileStartup. Desktop Trilium needs no layout override.
 *
 * This is intentionally a small, reversible DOM/CSS integration. It does NOT
 * replace Trilium's native note editor, ETAPI, or mobile navigator.
 */
(function triliuiMobileStartup() {
    "use strict";

    const STORAGE_KEY = "triliui.native.fixedTree.v1";
    const ACTIVE_CLASS = "triliui-fixed-tree";
    const STYLE_ID = "triliui-fixed-tree-style";
    const TOGGLE_ID = "triliui-fixed-tree-toggle";
    const REQUIRED_IDS = ["mobile-rest-container", "mobile-sidebar-wrapper", "detail-container", "launcher-pane"];

    // Safe mode and diagnostics are local-only URL switches; no network requests.
    const query = new URLSearchParams(window.location.search);
    if (query.get("triliuiOff") === "1") return;
    if (window.__triliuiFixedTreeInitialized || window.__triliuiBootstrapping) return;
    const DEBUG = query.get("triliuiDebug") === "1";
    const DIAG_ID = "triliui-diagnostic-banner";
    const VERSION = "0.1.1";
    window.__triliuiBootstrapping = true;

    function report(state, missingIds = []) {
        const data = { version: VERSION, state, missingIds, mobile: !!document.body?.classList.contains("mobile") };
        window.__triliuiDiagnostics = data;
        if (!DEBUG || !document.body) return;
        let banner = document.getElementById(DIAG_ID);
        if (!banner) {
            banner = document.createElement("div");
            banner.id = DIAG_ID;
            banner.setAttribute("role", "status");
            banner.style.cssText = "position:fixed;top:8px;right:8px;z-index:2147483640;max-width:80vw;pointer-events:none;font:12px/1.4 system-ui;color:#fff;background:#25394e;border:1px solid #a5b3c4;border-radius:7px;padding:8px;white-space:normal;";
            document.body.appendChild(banner);
        }
        const message = "TriliUI " + VERSION + " | " + state + (missingIds.length ? " | missing: " + missingIds.join(", ") : "");
        if (banner.textContent !== message) banner.textContent = message;
    }

    // A mobileStartup script may execute while Trilium is still assembling
    // its body classes and navigation widgets. Wait rather than exiting early.

    const css = `
/* TriliUI Phase 1. Scoped to mobile, active state and phone width only. */
body.mobile.${ACTIVE_CLASS} #mobile-rest-container {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    overflow: hidden !important;
}
@media (max-width: 991px) {
    body.mobile.${ACTIVE_CLASS} #mobile-rest-container > #mobile-sidebar-wrapper {
        position: relative !important;
        inset: auto !important;
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        transform: none !important;
        transition: none !important;
        flex: 0 0 var(--triliui-tree-width, clamp(112px, 34vw, 180px)) !important;
        width: var(--triliui-tree-width, clamp(112px, 34vw, 180px)) !important;
        max-width: var(--triliui-tree-width, clamp(112px, 34vw, 180px)) !important;
        min-width: 0 !important;
        height: 100% !important;
        border-inline-end: 1px solid var(--main-border-color, #666);
        background: var(--left-pane-background-color, var(--main-background-color)) !important;
        z-index: auto !important;
    }
    body.mobile.${ACTIVE_CLASS} #mobile-rest-container > #detail-container {
        position: relative !important;
        inset: auto !important;
        transform: none !important;
        transition: none !important;
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        flex: 1 1 0 !important;
        width: auto !important;
        max-width: none !important;
        min-width: 0 !important;
        height: 100% !important;
        z-index: auto !important;
    }
    body.mobile.${ACTIVE_CLASS} #detail-container::before {
        display: none !important;
    }

    /* The native mobile navigator is a one-column-at-a-time hierarchy. */
    body.mobile.${ACTIVE_CLASS} #mobile-sidebar-wrapper .mobile-note-navigator {
        --navigator-row-padding: 5px;
        --navigator-group-inset: 3px;
        --navigator-group-spacing: 7px;
    }
    body.mobile.${ACTIVE_CLASS} #mobile-sidebar-wrapper .mobile-navigator-current-preview,
    body.mobile.${ACTIVE_CLASS} #mobile-sidebar-wrapper .mobile-navigator-row-count,
    body.mobile.${ACTIVE_CLASS} #mobile-sidebar-wrapper .mobile-navigator-row-hidden-badge {
        display: none !important;
    }
    body.mobile.${ACTIVE_CLASS} #mobile-sidebar-wrapper .mobile-navigator-row {
        gap: 3px;
        min-height: 40px;
    }
    body.mobile.${ACTIVE_CLASS} #mobile-sidebar-wrapper .mobile-navigator-row-title,
    body.mobile.${ACTIVE_CLASS} #mobile-sidebar-wrapper .mobile-navigator-current-title {
        font-size: 0.78rem;
    }
    body.mobile.${ACTIVE_CLASS} #mobile-sidebar-wrapper .mobile-navigator-current-header {
        gap: 4px;
    }
    body.mobile.${ACTIVE_CLASS} #mobile-sidebar-wrapper .mobile-navigator-current-action {
        width: 30px;
        height: 34px;
    }
    body.mobile.${ACTIVE_CLASS} #mobile-sidebar-wrapper .mobile-navigator-back-title {
        font-size: 0.78rem;
    }
}

/* The switch stays in Trilium's own launcher row and remains accessible. */
#${TOGGLE_ID} {
    flex: 0 0 34px;
    width: 34px;
    height: 34px;
    border: 1px solid var(--main-border-color, #666);
    border-radius: 8px;
    margin: 0 3px;
    padding: 0;
    color: var(--main-text-color, inherit);
    background: var(--button-background-color, transparent);
    font-size: 20px;
    line-height: 1;
    touch-action: manipulation;
}
#${TOGGLE_ID}[aria-pressed="true"] {
    outline: 2px solid var(--active-item-background-color, #5796d7);
    outline-offset: -2px;
}
`;

    function readEnabled() {
        try {
            return window.localStorage.getItem(STORAGE_KEY) !== "off";
        } catch (_) {
            return true; // Storage may be disabled. No app data are modified.
        }
    }

    function persist(enabled) {
        try {
            window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
        } catch (_) {
            // Private browsing can deny storage. Current tab can still toggle.
        }
    }

    function install() {
        if (!document.body) {
            report("waiting-for-body");
            return false;
        }
        if (document.body.classList.contains("desktop")) {
            report("desktop-skipped");
            return false;
        }
        if (!document.body.classList.contains("mobile")) {
            report("waiting-for-mobile-class");
            return false;
        }
        // Fail closed if this release's internal mobile DOM changed.
        const missing = REQUIRED_IDS.filter((id) => !document.getElementById(id));
        if (missing.length) {
            report("waiting-for-layout", missing);
            return false;
        }

        if (!document.getElementById(STYLE_ID)) {
            const style = document.createElement("style");
            style.id = STYLE_ID;
            style.textContent = css;
            document.head.appendChild(style);
        }

        const toggle = document.createElement("button");
        toggle.id = TOGGLE_ID;
        toggle.type = "button";
        toggle.textContent = "☷";
        const launcher = document.getElementById("launcher-pane");

        let enabled = readEnabled();
        function update() {
            document.body.classList.toggle(ACTIVE_CLASS, enabled);
            toggle.setAttribute("aria-pressed", String(enabled));
            toggle.setAttribute("aria-label", enabled ? "TriliUI: 左ツリー固定を解除" : "TriliUI: 左ツリーを固定");
            toggle.title = enabled ? "TriliUI: 左ツリー固定 ON（押すと解除）" : "TriliUI: 左ツリー固定 OFF（押すと固定）";
        }

        toggle.addEventListener("click", () => {
            enabled = !enabled;
            persist(enabled);
            update();
        });
        launcher.prepend(toggle);
        update();
        window.__triliuiFixedTreeInitialized = true;
        report("ready");
        return true;
    }

    if (install()) {
        window.__triliuiBootstrapping = false;
        return;
    }

    // Observe both inserted layout elements and a delayed body.mobile class.
    const observer = new MutationObserver(() => {
        if (window.__triliuiFixedTreeInitialized) {
            observer.disconnect();
            return;
        }
        if (install()) {
            observer.disconnect();
            window.__triliuiBootstrapping = false;
        }
    });
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"]
    });
    window.setTimeout(() => {
        observer.disconnect();
        if (!window.__triliuiFixedTreeInitialized) {
            if (document.body?.classList.contains("desktop")) {
                report("desktop-skipped");
            } else {
                const missing = REQUIRED_IDS.filter((id) => !document.getElementById(id));
                report("timed-out", missing);
                console.warn("[TriliUI] Startup timed out. Open Trilium with ?triliuiDebug=1 to inspect the layout.");
            }
        }
        window.__triliuiBootstrapping = false;
    }, 15000);
})();
