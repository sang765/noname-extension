#!/usr/bin/env node
// Generate PNG icons from SVG using sharp (if available) or create simple placeholders

const fs = require('fs');
const path = require('path');

const iconDir = path.join(__dirname, 'src', 'icon');
const svgPath = path.join(__dirname, '..', 'noname-browser', 'res', 'icon.svg');

// Ensure icon directory exists
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

// Simple PNG generator (creates minimal valid PNG)
function createSimplePNG(size, color = '#6750A4') {
  // Create a minimal PNG with a solid color
  // This is a simplified approach - in production, use sharp or canvas
  const width = size;
  const height = size;
  
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type (RGB)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  
  // Create image data (simple solid color)
  const imageData = Buffer.alloc(width * height * 3);
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  
  for (let i = 0; i < width * height; i++) {
    imageData[i * 3] = r;
    imageData[i * 3 + 1] = g;
    imageData[i * 3 + 2] = b;
  }
  
  // Compress with zlib (simplified - just store uncompressed)
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(imageData);
  
  // Build PNG
  const chunks = [];
  
  // Signature
  chunks.push(signature);
  
  // IHDR
  const ihdrLength = Buffer.alloc(4);
  ihdrLength.writeUInt32BE(13, 0);
  chunks.push(ihdrLength);
  chunks.push(Buffer.from('IHDR'));
  chunks.push(ihdr);
  const ihdrCrc = crc32(Buffer.concat([Buffer.from('IHDR'), ihdr]));
  const ihdrCrcBuf = Buffer.alloc(4);
  ihdrCrcBuf.writeUInt32BE(ihdrCrc, 0);
  chunks.push(ihdrCrcBuf);
  
  // IDAT
  const idatLength = Buffer.alloc(4);
  idatLength.writeUInt32BE(compressed.length, 0);
  chunks.push(idatLength);
  chunks.push(Buffer.from('IDAT'));
  chunks.push(compressed);
  const idatCrc = crc32(Buffer.concat([Buffer.from('IDAT'), compressed]));
  const idatCrcBuf = Buffer.alloc(4);
  idatCrcBuf.writeUInt32BE(idatCrc, 0);
  chunks.push(idatCrcBuf);
  
  // IEND
  const iendLength = Buffer.alloc(4);
  iendLength.writeUInt32BE(0, 0);
  chunks.push(iendLength);
  chunks.push(Buffer.from('IEND'));
  const iendCrc = crc32(Buffer.from('IEND'));
  const iendCrcBuf = Buffer.alloc(4);
  iendCrcBuf.writeUInt32BE(iendCrc, 0);
  chunks.push(iendCrcBuf);
  
  return Buffer.concat(chunks);
}

// CRC32 implementation
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xEDB88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Generate icons
const sizes = [16, 48, 128];
const color = '#6750A4';

console.log('Generating PNG icons...');

for (const size of sizes) {
  const pngPath = path.join(iconDir, `icon${size}.png`);
  const png = createSimplePNG(size, color);
  fs.writeFileSync(pngPath, png);
  console.log(`Created: ${pngPath} (${png.length} bytes)`);
}

console.log('Done! Icons generated in src/icon/');
