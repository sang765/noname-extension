"use strict";

const enabledEl = document.getElementById("enabled");
const targetEl = document.getElementById("target");

getSettings().then((settings) => {
  enabledEl.checked = settings.enabled;
  targetEl.textContent = settings.packageName.trim() || "(unset)";
});

enabledEl.addEventListener("change", () => {
  setSettings({ enabled: enabledEl.checked });
});

document.getElementById("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
