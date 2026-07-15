# Titanium Extension for Android

[![Stars](https://img.shields.io/github/stars/jqssun/android-titanium-extension?label=Stars&logo=GitHub)](https://github.com/jqssun/android-titanium-extension)
[![GitHub](https://img.shields.io/github/downloads/jqssun/android-titanium-extension/total?label=GitHub&logo=GitHub)](https://github.com/jqssun/android-titanium-extension/releases)
[![license](https://img.shields.io/badge/License-GPLv2-blue.svg)](https://github.com/jqssun/android-titanium-extension/blob/main/LICENSE)
[![build](https://img.shields.io/github/actions/workflow/status/jqssun/android-titanium-extension/build.yml)](https://github.com/jqssun/android-titanium-extension/actions/workflows/build.yml)
[![release](https://img.shields.io/github/v/release/jqssun/android-titanium-extension)](https://github.com/jqssun/android-titanium-extension/releases)

A fully open-source browser extension for [**Titanium Browser for Android**](https://github.com/jqssun/android-titanium-browser) as well as other Chromium-based browsers. This extension offers additional features for Chromium on Android, including support for securely installing extensions from alternative marketplaces, using external download managers, adding support for enhanced dark mode, and more.

> [!NOTE]
> You can also use this on other browsers with support for extensions, although official support is only provided for [**Titanium Browser for Android**](https://github.com/jqssun/android-titanium-browser). Support for installing extensions from alternative marketplaces on other browsers requires a patched [`download_crx_util.cc`](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/browser/download/download_crx_util.cc).

## Usage

### Installation

Download the packed extension from [Releases](https://github.com/jqssun/android-titanium-extension/releases/latest/download/titanium.zip) and extract it to a folder. In [**Titanium Browser for Android**](https://github.com/jqssun/android-titanium-browser) or any other Chromium-based browser with support for extensions, open **Manage extensions** or [`chrome://extensions`](chrome://extensions), enable **Developer mode**, select **Load unpacked**, and choose the unpacked extension folder.

### Getting Extensions from Alternative Marketplaces

[**Titanium Browser for Android**](https://github.com/jqssun/android-titanium-browser) can install Chrome extensions from the [Chrome Web Store](https://chromewebstore.google.com/) with **Desktop site** enabled. For other marketplaces, you can use this extension. Once installed, downloading extensions from the following marketplaces is supported:
- [Opera Add-ons](https://addons.opera.com/)
- [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/)

You can also manually download the extension by going to **Extension options**. Copy the extension's marketplace page URL and paste it into the relevant URL field. Select **Get** to download the extension file. If no install prompt appears, unzip the downloaded extension file and load it unpacked.

### Using External Download Managers

You must first configure the download manager in **Extension options**. You can choose from a list of supported download managers using the application preset, or manually set the package ID as well as the intent format used by the download manager. The configured package ID must match the installed variant of the application exactly.

Once configured, browser downloads can be forwarded to any external download manager via `intent://` when redirect is enabled. Alternatively, you can long-press a link to access the context menu and select **Download with download manager** to manually send a URL to the download manager.
