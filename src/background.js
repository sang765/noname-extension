"use strict";

importScripts("common.js");

const MENU_ID = "noname-download-link";
const MENU_TITLE = "Download with download manager";

const handledIds = new Set();

async function cancelAndErase(id) {
  handledIds.add(id);
  try {
    await chrome.downloads.cancel(id);
  } catch (e) {
    logEvent(`cancel(${id}) failed: ${e.message}`);
  }
  try {
    await chrome.downloads.erase({ id });
  } catch {}
}

async function getCookieHeader(url) {
  try {
    const cookies = await chrome.cookies.getAll({ url });
    return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  } catch (e) {
    logEvent(`cookies.getAll failed: ${e.message}`);
    return "";
  }
}

async function getActiveTab() {
  let tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tabs.length) tabs = await chrome.tabs.query({ active: true });
  return tabs[0] || null;
}

// confirm: send.html tap = user gesture, ALLOWED
// auto: gesture-less tabs.update, REQUIRES_PROMPT
async function fireIntent(intentUrl, display) {
  const settings = await getSettings();
  if (settings.handoffMode === "auto") {
    const tab = await getActiveTab();
    if (tab && tab.id !== chrome.tabs.TAB_ID_NONE) {
      logEvent(`auto mode: navigating tab ${tab.id} to intent`);
      try {
        await chrome.tabs.update(tab.id, { url: intentUrl });
      } catch (e) {
        logEvent(`tabs.update failed: ${e.message}`);
      }
      return;
    }
  }
  const payload = encodeURIComponent(JSON.stringify({ intent: intentUrl, ...display }));
  try {
    await chrome.tabs.create({
      url: chrome.runtime.getURL("send.html") + "#" + payload,
      active: true,
    });
  } catch (e) {
    logEvent(`tabs.create(send.html) failed: ${e.message}`);
  }
}

async function handOff(url, meta) {
  const settings = await getSettings();
  if (settings.manager === "custom" && !settings.packageName.trim()) {
    logEvent("no package configured for custom manager; ignoring");
    return;
  }
  const ctx = {
    ua: navigator.userAgent,
    referrer: meta.referrer || "",
    filename: meta.filename || urlBasename(url),
    cookies: settings.forwardCookies ? await getCookieHeader(url) : "",
  };
  logEvent(`sending ${ctx.filename || url} to ${settings.packageName}`);
  await fireIntent(buildIntentUrl(url, settings, ctx), {
    name: ctx.filename,
    app: settings.packageName.trim(),
    url,
  });
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === "closeMe" && sender.tab) {
    chrome.tabs.remove(sender.tab.id).catch(() => {});
  } else if (msg && msg.type === "log") {
    logEvent(msg.text);
  } else if (msg && msg.type === "getCrx" && msg.crx) {
    // needs a visible page
    chrome.tabs.create({
      url: chrome.runtime.getURL("install.html") + "#" + encodeURIComponent(msg.crx),
      active: true,
    });
  }
});

function shouldRedirect(item, settings) {
  if (!settings.enabled) return "disabled in settings";
  if (handledIds.has(item.id)) return "already handled";
  const url = item.finalUrl || item.url;
  let protocol = "";
  try { protocol = new URL(url).protocol; } catch {}
  if (protocol !== "http:" && protocol !== "https:") return `non-http scheme ${protocol}`;
  if (item.state && item.state !== "in_progress") return `state ${item.state}`;
  if (item.mime === "application/x-chrome-extension") return "crx (browser installs it)";
  const skip = settings.skipExtensions
    .split(",")
    .map((s) => s.trim().toLowerCase().replace(/^\./, ""))
    .filter(Boolean);
  if (skip.includes(fileExtension(url))) return "extension in skip list";
  return "";
}

chrome.downloads.onCreated.addListener(async (item) => {
  const settings = await getSettings();
  const url = item.finalUrl || item.url;
  const reason = shouldRedirect(item, settings);
  if (reason) {
    if (reason !== "already handled") logEvent(`skipped download ${url}: ${reason}`);
    return;
  }
  logEvent(`redirecting download ${url}`);
  await cancelAndErase(item.id);
  await handOff(url, {
    referrer: item.referrer || "",
    filename: item.filename ? item.filename.split("/").pop() : "",
  });
});

async function rebuildMenu() {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: MENU_ID,
    title: MENU_TITLE,
    contexts: ["link", "video", "audio", "image"],
  });
}

async function syncMarketplacePatches() {
  const settings = await getSettings();
  const enable = [];
  const disable = [];
  (settings.patchEdge ? enable : disable).push("edge_ua");
  (settings.patchOpera ? enable : disable).push("opera_ua");
  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: enable,
      disableRulesetIds: disable,
    });
  } catch (e) {
    logEvent(`updateEnabledRulesets failed: ${e.message}`);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  logEvent(`installed/updated v${chrome.runtime.getManifest().version}`);
  rebuildMenu();
  syncMarketplacePatches();
});
chrome.runtime.onStartup.addListener(() => {
  rebuildMenu();
  syncMarketplacePatches();
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID) return;
  const url = info.linkUrl || info.srcUrl;
  if (!url || !/^https?:/i.test(url)) return;
  logEvent(`context menu handoff for ${url}`);
  await handOff(url, { referrer: info.pageUrl || "" });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.patchEdge || changes.patchOpera) syncMarketplacePatches();
});
