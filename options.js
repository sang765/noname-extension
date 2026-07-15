"use strict";

const els = {
  enabled: document.getElementById("enabled"),
  skipExtensions: document.getElementById("skipExtensions"),
  handoffMode: document.getElementById("handoffMode"),
  manager: document.getElementById("manager"),
  packageName: document.getElementById("packageName"),
  knownPackages: document.getElementById("knownPackages"),
  customModeRow: document.getElementById("customModeRow"),
  customMode: document.getElementById("customMode"),
  forwardCookies: document.getElementById("forwardCookies"),
  patchEdge: document.getElementById("patchEdge"),
  patchOpera: document.getElementById("patchOpera"),
  saved: document.getElementById("saved"),
  cwsUrl: document.getElementById("cwsUrl"),
  cwsGet: document.getElementById("cwsGet"),
  edgeUrl: document.getElementById("edgeUrl"),
  edgeGet: document.getElementById("edgeGet"),
  operaUrl: document.getElementById("operaUrl"),
  operaGet: document.getElementById("operaGet"),
  getError: document.getElementById("getError"),
  devMode: document.getElementById("devMode"),
  devTools: document.getElementById("devTools"),
  clearLog: document.getElementById("clearLog"),
  devLog: document.getElementById("devLog"),
};

async function renderLog() {
  const log = await getEventLog();
  els.devLog.textContent = log.length ? log.join("\n") : "(empty)";
  els.devLog.scrollTop = els.devLog.scrollHeight;
}

const DEV_KEY = "devMode";
chrome.storage.local.get(DEV_KEY).then((v) => {
  els.devMode.checked = !!v[DEV_KEY];
  els.devTools.hidden = !els.devMode.checked;
});
els.devMode.addEventListener("change", () => {
  els.devTools.hidden = !els.devMode.checked;
  chrome.storage.local.set({ [DEV_KEY]: els.devMode.checked });
});
els.clearLog.addEventListener("click", async () => {
  await chrome.storage.local.set({ [LOG_KEY]: [] });
  renderLog();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[LOG_KEY]) renderLog();
});
renderLog();

function wireGet(input, button, marketplace, onGet) {
  const go = async () => {
    const crx = crxUrlFromMarketplaceUrl(input.value, marketplace);
    els.getError.hidden = !!crx || !input.value.trim();
    if (!crx) return;
    logEvent(`fetching crx for ${input.value.trim()}`);
    await (onGet ? onGet(crx) : chrome.tabs.create({ url: crx }));
  };
  button.addEventListener("click", go);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") go();
  });
}
wireGet(els.cwsUrl, els.cwsGet, CRX_MARKETPLACES.cws);
wireGet(els.edgeUrl, els.edgeGet, CRX_MARKETPLACES.edge, getCrx);
wireGet(els.operaUrl, els.operaGet, CRX_MARKETPLACES.opera, getCrx);

for (const [key, mgr] of Object.entries(MANAGERS)) {
  const opt = document.createElement("option");
  opt.value = key;
  opt.textContent = mgr.name;
  els.manager.appendChild(opt);
}

function refreshManagerUi(settings) {
  const mgr = MANAGERS[els.manager.value] || MANAGERS.custom;
  els.knownPackages.replaceChildren(
    ...mgr.knownPackages.map((p) => {
      const o = document.createElement("option");
      o.value = p;
      return o;
    })
  );
  els.customModeRow.hidden = els.manager.value !== "custom";
  if (settings === undefined) {
    els.packageName.value = mgr.defaultPackage;
  }
}

let saveTimer;
function save() {
  setSettings({
    enabled: els.enabled.checked,
    skipExtensions: els.skipExtensions.value,
    handoffMode: els.handoffMode.value,
    manager: els.manager.value,
    packageName: els.packageName.value.trim(),
    customMode: els.customMode.value,
    forwardCookies: els.forwardCookies.checked,
    patchEdge: els.patchEdge.checked,
    patchOpera: els.patchOpera.checked,
  }).then(() => {
    els.saved.style.visibility = "visible";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => (els.saved.style.visibility = "hidden"), 1200);
  });
}

getSettings().then((settings) => {
  els.enabled.checked = settings.enabled;
  els.skipExtensions.value = settings.skipExtensions;
  els.handoffMode.value = settings.handoffMode;
  els.manager.value = settings.manager;
  els.packageName.value = settings.packageName;
  els.customMode.value = settings.customMode;
  els.forwardCookies.checked = settings.forwardCookies;
  els.patchEdge.checked = settings.patchEdge;
  els.patchOpera.checked = settings.patchOpera;
  refreshManagerUi(settings);

  els.manager.addEventListener("change", () => {
    els.enabled.checked = true;
    refreshManagerUi();
    save();
  });
  for (const el of [els.enabled, els.skipExtensions, els.handoffMode, els.packageName, els.customMode, els.forwardCookies, els.patchEdge, els.patchOpera]) {
    el.addEventListener("change", save);
  }
});
