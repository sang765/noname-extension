#!/bin/bash
rm -rf dist && mkdir -p dist/titanium
rsync -a src/ dist/titanium/
(cd dist/titanium && zip -qr ../titanium.zip .)
node crx.js dist/titanium.zip dist/titanium.crx
