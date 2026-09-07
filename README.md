# NoName Extension for Android

[![Stars](https://img.shields.io/github/stars/sang765/noname-extension?label=Stars&logo=GitHub)](https://github.com/sang765/noname-extension)
[![GitHub](https://img.shields.io/github/downloads/sang765/noname-extension/total?label=GitHub&logo=GitHub)](https://github.com/sang765/noname-extension/releases)
[![license](https://img.shields.io/badge/License-GPLv2-blue.svg)](https://github.com/sang765/noname-extension/blob/main/LICENSE)
[![build](https://img.shields.io/github/actions/workflow/status/sang765/noname-extension/build.yml)](https://github.com/sang765/noname-extension/actions/workflows/build.yml)
[![release](https://img.shields.io/github/v/release/sang765/noname-extension)](https://github.com/sang765/noname-extension/releases)

A fully open-source browser extension for [**NoName Browser for Android**](https://github.com/sang765/noname-browser) as well as other Chromium-based browsers. This extension offers additional features for Chromium on Android, including support for securely installing extensions from alternative marketplaces, using external download managers, adding support for enhanced dark mode, and more.

> [!NOTE]
> You can also use this on other browsers with support for extensions, although official support is only provided for [**NoName Browser for Android**](https://github.com/sang765/noname-browser). Support for installing extensions from alternative marketplaces on other browsers requires a patched [`download_crx_util.cc`](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/browser/download/download_crx_util.cc).

## Usage

### Installation

Download the packed extension from [Releases](https://github.com/sang765/noname-extension/releases/latest/download/noname.zip) and extract it to a folder. In [**NoName Browser for Android**](https://github.com/sang765/noname-browser) or any other Chromium-based browser with support for extensions, open **Manage extensions** or [`chrome://extensions`](chrome://extensions), enable **Developer mode**, select **Load unpacked**, and choose the unpacked extension folder.

### Getting Extensions from Alternative Marketplaces

[**NoName Browser for Android**](https://github.com/sang765/noname-browser) can install Chrome extensions from the [Chrome Web Store](https://chromewebstore.google.com/) with **Desktop site** enabled. For other marketplaces, you can use this extension. Once installed, downloading extensions from the following marketplaces is supported:
- [Opera Add-ons](https://addons.opera.com/)
- [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/)

You can also manually download the extension by going to **Extension options**. Copy the extension's marketplace page URL and paste it into the relevant URL field. Select **Get** to download the extension file. If no install prompt appears, unzip the downloaded extension file and load it unpacked.

### Using External Download Managers

You must first configure the download manager in **Extension options**. You can choose from a list of supported download managers using the application preset, or manually set the package ID as well as the intent format used by the download manager. The configured package ID must match the installed variant of the application exactly.

Once configured, browser downloads can be forwarded to any external download manager via `intent://` when redirect is enabled. Alternatively, you can long-press a link to access the context menu and select **Download with download manager** to manually send a URL to the download manager.

## Credits

This project is a fork of [**Titanium Extension**](https://github.com/jqssun/android-titanium-extension) by [jqssun](https://github.com/jqssun), which itself is based on [Vanadium](https://github.com/GrapheneOS/Vanadium) by [GrapheneOS](https://github.com/GrapheneOS). All credit goes to the original authors and contributors.

## License

GPL-2.0 — see [LICENSE](LICENSE) for details.
