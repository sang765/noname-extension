"use strict";

let payload = null;
try {
  payload = JSON.parse(decodeURIComponent(location.hash.slice(1)));
} catch {}

if (!payload || !payload.intent || !payload.intent.startsWith("intent:")) {
  document.getElementById("name").textContent = "Nothing to send.";
  document.getElementById("send").hidden = true;
} else {
  document.getElementById("name").textContent = payload.name || "(file)";
  document.getElementById("url").textContent = payload.url || "";
  document.getElementById("send").textContent = `Send to ${payload.app || "app"}`;

  document.getElementById("send").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "log", text: `send tapped for ${payload.name || payload.url}` });
    document.getElementById("hint").hidden = false;
    location.href = payload.intent;
    setTimeout(() => chrome.runtime.sendMessage({ type: "closeMe" }), 6000);
  });
}

document.getElementById("cancel").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.sendMessage({ type: "closeMe" });
});
