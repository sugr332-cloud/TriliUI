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

    // Do not change the desktop UI, and support emergency recovery:
    // add ?triliuiOff=1 to the Trilium URL (on an already authenticated session).
    if (!document.body || !document.body.classList.contains("mobile")) return;
    if (new URLSearchParams(window.location.search).get("triliuiOff") === "1") return;
    if (window.__triliuiFixedTreeInitialized) return;

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
    body.mobile.${ACTIVE_CLASS} #mobile-sidebar-wrapper .mobile-navigator-row-hidden-badge,
    body.mobile.${ACTIVE_CLASS} #mobile-sidebar-wrapper .mobile-navigator-workspaces {
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
        // Fail closed if this release's internal mobile DOM changed.
        const els = REQUIRED_IDS.map((id) => document.getElementById(id));
        if (els.some((node) => !node)) return false;

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
        return true;
    }

    if (install()) return;

    // Startup scripts can run before the mobile layout has mounted.
    const observer = new MutationObserver(() => {
        if (install()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => {
        observer.disconnect();
        if (!window.__triliuiFixedTreeInitialized) {
            console.warn("[TriliUI] The mobile layout selectors did not match. No changes were applied.");
        }
    }, 10000);
})();
