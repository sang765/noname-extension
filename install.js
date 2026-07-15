"use strict";

const crx = decodeURIComponent(location.hash.slice(1));
const status = document.getElementById("status");

if (!/^https?:/.test(crx)) {
  status.textContent = "Nothing to get.";
} else {
  getCrx(crx)
    .then(() => (status.textContent = "Use the prompt to proceed with adding the extension."))
    .catch((e) => (status.textContent = "Download failed: " + e.message));
}
