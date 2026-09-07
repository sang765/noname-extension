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
  console.log("[NoName] " + msg);
  try {
    const stamp = new Date().toTimeString().slice(0, 8);
    const { [LOG_KEY]: log = [] } = await chrome.storage.local.get(LOG_KEY);
    log.push(`${stamp} ${msg}`);
    while (log.length > LOG_MAX) log.shift();
    await chrome.storage.local.set({ [LOG_KEY]: log });
  } catch (e) {
    console.warn("[NoName] logEvent failed:", e);
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

const CRX_MIME = "application/x-chrome-extension";
const CRX_SIGNATURE_CONTEXT = new Uint8Array([
  0x43, 0x52, 0x58, 0x33, 0x20, 0x53, 0x69, 0x67,
  0x6e, 0x65, 0x64, 0x44, 0x61, 0x74, 0x61, 0x00,
]); // signature context

function concatBytes(...parts) {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function u32le(n) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0, true);
  return b;
}

function pbVarint(n) {
  const out = [];
  while (n > 0x7f) {
    out.push((n & 0x7f) | 0x80);
    n = Math.floor(n / 128);
  }
  out.push(n & 0x7f);
  return out;
}

function pbBytesField(fieldNumber, data) {
  const tag = fieldNumber * 8 + 2;
  return Uint8Array.from([...pbVarint(tag), ...pbVarint(data.length), ...data]);
}

function isCrxBytes(bytes) {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x43 &&
    bytes[1] === 0x72 &&
    bytes[2] === 0x32 &&
    bytes[3] === 0x34
  );
}

// components/crx_file/crx3.proto
async function packCrx3(zipBytes) {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const privateKey = pair.privateKey;
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
  const fullHash = new Uint8Array(await crypto.subtle.digest("SHA-256", spki));
  const crxId = fullHash.slice(0, 16);
  const signedData = pbBytesField(1, crxId);
  const toSign = concatBytes(
    CRX_SIGNATURE_CONTEXT,
    u32le(signedData.length),
    signedData,
    zipBytes
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, toSign)
  );
  const proof = concatBytes(pbBytesField(1, spki), pbBytesField(2, sig));
  const header = concatBytes(
    pbBytesField(2, proof),
    pbBytesField(10000, signedData)
  );

  return concatBytes(
    new Uint8Array([0x43, 0x72, 0x32, 0x34]),
    u32le(3),
    u32le(header.length),
    header,
    zipBytes
  );
}

async function inflateRaw(bytes) {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function parseZip(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const minEocd = Math.max(0, bytes.length - 22 - 65536);
  for (let i = bytes.length - 22; i >= minEocd; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const cdCount = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const entries = [];
  for (let n = 0; n < cdCount; n++) {
    if (p + 46 > bytes.length || dv.getUint32(p, true) !== 0x02014b50) break;
    const flags = dv.getUint16(p + 8, true);
    const method = dv.getUint16(p + 10, true);
    const mtime = dv.getUint16(p + 12, true);
    const mdate = dv.getUint16(p + 14, true);
    const crc = dv.getUint32(p + 16, true);
    const compSize = dv.getUint32(p + 20, true);
    const uncompSize = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOffset = dv.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    const lhNameLen = dv.getUint16(localOffset + 26, true);
    const lhExtraLen = dv.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + lhNameLen + lhExtraLen;
    const data = bytes.subarray(dataStart, dataStart + compSize);
    entries.push({ name, flags, method, mtime, mdate, crc, compSize, uncompSize, data });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function buildZip(entries) {
  const enc = new TextEncoder();
  const locals = [];
  const central = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = enc.encode(e.name);
    const flags = e.flags & ~0x8;
    const lh = new Uint8Array(30 + nameBuf.length);
    const ldv = new DataView(lh.buffer);
    ldv.setUint32(0, 0x04034b50, true);
    ldv.setUint16(4, 20, true);
    ldv.setUint16(6, flags, true);
    ldv.setUint16(8, e.method, true);
    ldv.setUint16(10, e.mtime, true);
    ldv.setUint16(12, e.mdate, true);
    ldv.setUint32(14, e.crc, true);
    ldv.setUint32(18, e.compSize, true);
    ldv.setUint32(22, e.uncompSize, true);
    ldv.setUint16(26, nameBuf.length, true);
    lh.set(nameBuf, 30);
    const localOffset = offset;
    const rec = concatBytes(lh, e.data);
    locals.push(rec);
    offset += rec.length;
    const ch = new Uint8Array(46 + nameBuf.length);
    const cdv = new DataView(ch.buffer);
    cdv.setUint32(0, 0x02014b50, true);
    cdv.setUint16(4, 20, true);
    cdv.setUint16(6, 20, true);
    cdv.setUint16(8, flags, true);
    cdv.setUint16(10, e.method, true);
    cdv.setUint16(12, e.mtime, true);
    cdv.setUint16(14, e.mdate, true);
    cdv.setUint32(16, e.crc, true);
    cdv.setUint32(20, e.compSize, true);
    cdv.setUint32(24, e.uncompSize, true);
    cdv.setUint16(28, nameBuf.length, true);
    cdv.setUint32(42, localOffset, true);
    ch.set(nameBuf, 46);
    central.push(ch);
  }
  const localBlob = concatBytes(...locals);
  const centralBlob = concatBytes(...central);
  const eocd = new Uint8Array(22);
  const edv = new DataView(eocd.buffer);
  edv.setUint32(0, 0x06054b50, true);
  edv.setUint16(8, entries.length, true);
  edv.setUint16(10, entries.length, true);
  edv.setUint32(12, centralBlob.length, true);
  edv.setUint32(16, localBlob.length, true);
  return concatBytes(localBlob, centralBlob, eocd);
}

async function manifestNameFromEntries(entries) {
  const m = entries.find((e) => e.name === "manifest.json");
  if (!m) return null;
  try {
    let raw;
    if (m.method === 0) raw = m.data;
    else if (m.method === 8) raw = await inflateRaw(m.data);
    else return null;
    const json = JSON.parse(new TextDecoder().decode(raw));
    return json && typeof json.name === "string" ? json.name : null;
  } catch {
    return null;
  }
}

// manifest.json at root
async function normalizeExtensionZip(bytes) {
  const entries = parseZip(bytes);
  if (!entries) return { bytes, name: null };
  if (entries.some((e) => e.name === "manifest.json")) {
    return { bytes, name: await manifestNameFromEntries(entries) };
  }
  let prefix = null;
  for (const e of entries) {
    if (e.name.endsWith("/manifest.json")) {
      const candidate = e.name.slice(0, e.name.length - "manifest.json".length);
      if (prefix === null || candidate.length < prefix.length) prefix = candidate;
    }
  }
  if (!prefix) return { bytes, name: null };
  const stripped = entries
    .filter((e) => e.name.startsWith(prefix) && e.name.length > prefix.length)
    .map((e) => ({ ...e, name: e.name.slice(prefix.length) }));
  return {
    bytes: buildZip(stripped),
    name: await manifestNameFromEntries(stripped),
  };
}

function safeCrxDownloadName(base) {
  const cleaned = (base || "extension")
    .replace(/\.(crx|zip)$/i, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^[._]+|[._]+$/g, "")
    .slice(0, 60);
  return (cleaned || "extension") + ".crx";
}

// install on completion
function installFromCrxBytes(crxBytes, base) {
  const url = URL.createObjectURL(new Blob([crxBytes], { type: CRX_MIME }));
  const filename = safeCrxDownloadName(base);
  return chrome.downloads.download({ url, filename }).then(
    (id) =>
      new Promise((resolve) => {
        logEvent(`crx download #${id}`);
        let settled = false;
        const finish = (result) => {
          if (settled) return;
          settled = true;
          chrome.downloads.onChanged.removeListener(onChanged);
          URL.revokeObjectURL(url);
          resolve(result);
        };
        const maybeAcceptDanger = (danger) => {
          if (danger && danger !== "safe" && danger !== "accepted") {
            chrome.downloads.acceptDanger(id).catch(() => {});
          }
        };
        const onChanged = (delta) => {
          if (delta.id !== id) return;
          maybeAcceptDanger(delta.danger && delta.danger.current);
          const state = delta.state && delta.state.current;
          if (state === "complete") finish({ id, ok: true });
          else if (state === "interrupted") {
            finish({ id, ok: false, error: "download interrupted" });
          }
        };
        chrome.downloads.onChanged.addListener(onChanged);
        chrome.downloads.search({ id }).then((items) => {
          const it = items && items[0];
          if (!it) return;
          maybeAcceptDanger(it.danger);
          if (it.state === "complete") finish({ id, ok: true });
          else if (it.state === "interrupted") {
            finish({ id, ok: false, error: "download interrupted" });
          }
        });
      })
  );
}

async function installExtensionFile(arrayBuf, filename) {
  const bytes = new Uint8Array(arrayBuf);
  logEvent(`installing ${filename}`);
  if (isCrxBytes(bytes)) return installFromCrxBytes(bytes, filename);
  const norm = await normalizeExtensionZip(bytes);
  const name = norm.name || filename;
  const crxBytes = await packCrx3(norm.bytes);
  return installFromCrxBytes(crxBytes, name);
}
