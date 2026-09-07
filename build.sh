#!/bin/bash
rm -rf dist && mkdir -p dist/noname
cp -r src/* dist/noname/
(cd dist/noname && zip -qr ../noname.zip .)
node crx.js dist/noname.zip dist/noname.crx
