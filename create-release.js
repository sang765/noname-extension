#!/usr/bin/env node
// Pack extension for release
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const distDir = path.join(__dirname, 'dist');
const srcDir = path.join(__dirname, 'src');
const zipPath = path.join(distDir, 'noname.zip');

// Clean and create dist
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir, { recursive: true });

// Create zip
execSync(`cd ${srcDir} && zip -r ${zipPath} .`, { stdio: 'inherit' });
console.log(`Created: ${zipPath}`);
console.log(`Size: ${fs.statSync(zipPath).size} bytes`);
