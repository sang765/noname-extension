"use strict";

const ONEDM_PACKAGES = [
  "idm.internet.download.manager",
  "idm.internet.download.manager.plus",
  "idm.internet.download.manager.adm.lite",
];

function onedmExtras(ctx) {
  const e = {};
  if (ctx.ua) e.extra_useragent = ctx.ua;
  if (ctx.referrer) e.extra_referer = ctx.referrer;
  if (ctx.cookies) e.extra_cookies = ctx.cookies;
  if (ctx.filename) e.extra_filename = ctx.filename;
  return e;
}

const MANAGERS = {
  adm: {
    name: "ADM",
    defaultPackage: "com.dv.adm",
    knownPackages: ["com.dv.adm", "com.dv.adm.pay", "com.dv.get"],
    mode: "view",
  },
  onedm: {
    name: "1DM",
    defaultPackage: "idm.internet.download.manager",
    knownPackages: ONEDM_PACKAGES,
    mode: "view",
    extras: onedmExtras,
  },
  onedmplus: {
    name: "1DM+",
    defaultPackage: "idm.internet.download.manager.plus",
    knownPackages: ONEDM_PACKAGES,
    mode: "view",
    extras: onedmExtras,
  },
  custom: {
    name: "Custom",
    defaultPackage: "",
    knownPackages: [],
    mode: "view",
  },
};

const DEFAULT_SETTINGS = {
  enabled: false,
  manager: "custom",
  packageName: "",
  customMode: "view",
  forwardCookies: true,
  skipExtensions: "crx",
  handoffMode: "confirm",
  patchEdge: true,
  patchOpera: true,
};

function getSettings() {
  return chrome.storage.local.get(DEFAULT_SETTINGS);
}

function setSettings(patch) {
  return chrome.storage.local.set(patch);
}

const LOG_KEY = "eventLog";
const LOG_MAX = 500;

async function logEvent(msg) {
  console.log("[Titanium] " + msg);
  try {
    const stamp = new Date().toTimeString().slice(0, 8);
    const { [LOG_KEY]: log = [] } = await chrome.storage.local.get(LOG_KEY);
    log.push(`${stamp} ${msg}`);
    while (log.length > LOG_MAX) log.shift();
    await chrome.storage.local.set({ [LOG_KEY]: log });
  } catch (e) {
    console.warn("[Titanium] logEvent failed:", e);
  }
}

function getEventLog() {
  return chrome.storage.local.get(LOG_KEY).then((v) => v[LOG_KEY] || []);
}

function managerMode(settings) {
  const mgr = MANAGERS[settings.manager] || MANAGERS.custom;
  return settings.manager === "custom" ? settings.customMode : mgr.mode;
}

// escape special characters
function intentValue(v) {
  return encodeURIComponent(v);
}

// no S.browser_fallback_url: with one present, chromium's prompt path
function buildIntentUrl(downloadUrl, settings, ctx) {
  const mgr = MANAGERS[settings.manager] || MANAGERS.custom;
  const mode = managerMode(settings);
  const pkg = settings.packageName.trim();
  const u = new URL(downloadUrl);
  const scheme = u.protocol.slice(0, -1);
  u.hash = "";
  const withoutScheme = u.href.slice(u.protocol.length + 2);

  const parts = [];
  let head;
  if (mode === "send") {
    head = "intent:";
    parts.push("action=android.intent.action.SEND");
    parts.push("type=text/plain");
    parts.push("S.android.intent.extra.TEXT=" + intentValue(u.href));
  } else {
    head = "intent://" + withoutScheme;
    parts.push("action=android.intent.action.VIEW");
    parts.push("scheme=" + scheme);
  }
  if (pkg) parts.push("package=" + pkg);
  if (mgr.extras && ctx) {
    for (const [k, v] of Object.entries(mgr.extras(ctx))) {
      parts.push("S." + k + "=" + intentValue(v));
    }
  }
  return head + "#Intent;" + parts.join(";") + ";end";
}

// cws endpoint mirrors WebstoreInstaller::GetWebstoreInstallURL
const CRX_MARKETPLACES = {
  cws: {
    host: "chromewebstore.google.com",
    detail: /^\/detail\/(?:[^/]+\/)?([a-p]{32})/i,
    endpoint: (id) =>
      "https://clients2.google.com/service/update2/crx?response=redirect" +
      "&os=android&arch=arm64&prod=chromiumcrx&prodchannel=stable" +
      `&prodversion=${chromeVersion()}&lang=${navigator.language}` +
      `&acceptformat=crx3,puff&x=id%3D${id}%26installsource%3Dondemand%26uc`,
  },
  edge: {
    host: "microsoftedge.microsoft.com",
    detail: /^\/addons\/detail\/(?:[^/]+\/)?([a-p]{32})/i,
    endpoint: (id) =>
      "https://edge.microsoft.com/extensionwebstorebase/v1/crx?response=redirect" +
      `&x=id%3D${id}%26installsource%3Dondemand%26uc`,
  },
  opera: {
    host: "addons.opera.com",
    detail: /\/extensions\/details\/([^/]+)/,
    endpoint: (slug) => `https://addons.opera.com/extensions/download/${slug}/`,
  },
};

function chromeVersion() {
  return (navigator.userAgent.match(/Chrome\/([\d.]+)/) || [])[1] || "134.0.0.0";
}

function crxUrlFromMarketplaceUrl(raw, marketplace) {
  let u;
  try { u = new URL(raw.trim()); } catch { return ""; }
  for (const s of marketplace ? [marketplace] : Object.values(CRX_MARKETPLACES)) {
    const m = u.hostname === s.host && u.pathname.match(s.detail);
    if (m) return s.endpoint(m[1]);
  }
  return "";
}

// auto-accept prompt
function getCrx(crx) {
  return chrome.downloads.download({ url: crx }).then((id) => {
    logEvent(`crx download #${id}`);
    const onChanged = (d) => {
      if (d.id !== id) return;
      const danger = d.danger && d.danger.current;
      if (danger && danger !== "safe" && danger !== "accepted") {
        chrome.downloads.acceptDanger(id)
          .then(() => logEvent(`acceptDanger #${id}: accepted`))
          .catch((e) => logEvent(`acceptDanger #${id}: ${e.message}`));
      }
      if (d.state && d.state.current !== "in_progress") {
        chrome.downloads.onChanged.removeListener(onChanged);
      }
    };
    chrome.downloads.onChanged.addListener(onChanged);
    return id;
  });
}

function urlBasename(rawUrl) {
  try {
    const path = new URL(rawUrl).pathname;
    const base = decodeURIComponent(path.split("/").filter(Boolean).pop() || "");
    return base.includes(".") ? base : "";
  } catch {
    return "";
  }
}

function fileExtension(rawUrl) {
  const base = urlBasename(rawUrl);
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}
