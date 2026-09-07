#!/bin/bash
rm -rf dist && mkdir -p dist
cp -r src/* dist/
(cd dist && zip -qr ../noname.zip .)
node crx.js noname.zip noname.crx
