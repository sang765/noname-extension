"use strict";

const BAR_ID = "noname-crx-bar";

const OVERLAY_CSS =
  "position:fixed;margin:0;box-sizing:border-box;background:#6750A4;color:#fff;" +
  "font:600 14px system-ui,sans-serif;border:0;border-radius:4px;cursor:pointer;" +
  "display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent";
const TOPBAR_CSS =
  "position:fixed;left:0;right:0;top:0;bottom:auto;width:100%;max-width:none;margin:0;" +
  "box-sizing:border-box;padding:14px 20px;background:#6750A4;color:#fff;" +
  "font:600 16px system-ui,sans-serif;text-align:center;border:0;cursor:pointer;" +
  "-webkit-tap-highlight-color:transparent";

let bar = null;
let getBtn = null;
let mode = "top";

function findGetButton() {
  for (const b of document.querySelectorAll("button")) {
    const t = (b.textContent || "").trim();
    if (t === "Get" || t === "Install") return b;
  }
  return null;
}

function* allElements(root) {
  for (const e of root.querySelectorAll("*")) {
    yield e;
    if (e.shadowRoot) yield* allElements(e.shadowRoot);
  }
}

function hideIncompatible() {
  const re = /incompatible with your browser/i;
  for (const e of allElements(document)) {
    if (re.test(e.textContent || "") &&
        !Array.from(e.children).some((c) => re.test(c.textContent || ""))) {
      e.style.setProperty("display", "none", "important");
    }
  }
}

function make() {
  bar = document.createElement("div");
  bar.id = BAR_ID;
  bar.setAttribute("popover", "manual");
  bar.setAttribute("role", "button");
  bar.addEventListener("click", () => {
    const crx = crxUrlFromMarketplaceUrl(location.href);
    if (crx) chrome.runtime.sendMessage({ type: "getCrx", crx });
  });
  (document.body || document.documentElement).appendChild(bar);
}

function reposition() {
  if (mode !== "overlay" || !bar || !getBtn || !getBtn.isConnected) return;
  const r = getBtn.getBoundingClientRect();
  bar.style.left = r.left + "px";
  bar.style.top = r.top + "px";
  bar.style.width = r.width + "px";
  bar.style.height = r.height + "px";
}

function refresh() {
  if (!crxUrlFromMarketplaceUrl(location.href)) {
    if (bar) { try { bar.hidePopover(); } catch (e) {} bar.remove(); bar = null; }
    return;
  }
  if (!bar || !bar.isConnected) make();
  try { bar.showPopover(); } catch (e) {}
  hideIncompatible();
  getBtn = findGetButton();
  if (getBtn) {
    mode = "overlay";
    bar.textContent = "Get";
    bar.style.cssText = OVERLAY_CSS;
    reposition();
  } else {
    mode = "top";
    bar.textContent = "Get extension";
    bar.style.cssText = TOPBAR_CSS;
  }
}

getSettings().then((s) => {
  if (!s.patchEdge) return;
  refresh();
  setInterval(refresh, 1000);
  addEventListener("scroll", reposition, true);
  addEventListener("resize", reposition);
});
