#!/usr/bin/env node
/**
 * Generates the PWA icons (192, 512, maskable 512) as real PNGs — no image
 * dependencies: a minimal PNG encoder (zlib) + rasterized compass mark drawn
 * with the product palette. Run once: `node scripts/gen-icons.cjs`.
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(size, pixelFn) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x / (size - 1), y / (size - 1), Math.hypot(x / size - 0.5, y / size - 0.5));
      const off = y * (size * 4 + 1) + 1 + x * 4;
      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
      raw[off + 3] = a;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const lerp = (a, b, t) => Math.round(a + (b - a) * t);

function draw(x, y, r, maskable) {
  // background: brand-blue gradient disc on white paper
  const cx = x - 0.5;
  const cy = y - 0.5;
  const grad = Math.min(1, Math.max(0, (cx + cy + 1) / 2));
  // palette
  const brandA = [29, 78, 216];
  const brandB = [59, 130, 246];
  const paper = [255, 255, 255];
  const ink = [255, 255, 255];
  const discR = maskable ? 0.38 : 0.42; // safe zone for maskable
  const ring = discR + 0.02;
  let color = [...paper, 255];
  const d = r;
  if (d < discR) {
    color = [
      lerp(brandA[0], brandB[0], grad),
      lerp(brandA[1], brandB[1], grad),
      lerp(brandA[2], brandB[2], grad),
      255
    ];
    // inner ring (stroke)
    if (d > discR - 0.055) color = [255, 255, 255, 90];
    // needle: vertical diamond, bright north / deep-cream south for contrast
    const nx = Math.abs(cx);
    const north = cy < 0;
    const needleHalfW = 0.055;
    const needleLen = discR * 0.82;
    if (nx < needleHalfW && Math.abs(cy) < needleLen) {
      const taper = 1 - Math.abs(cy) / needleLen;
      if (nx < needleHalfW * taper * 1.35) color = north ? [255, 255, 255, 245] : [42, 60, 62, 235];
    }
    // hub
    if (d < 0.045) color = [246, 243, 236, 255];
  } else if (d < ring && !maskable) {
    // soft edge anti-alias
    color = [...brandA, Math.round(255 * (ring - d) / 0.02)];
  }
  return color;
}

const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });
for (const [name, size, maskable] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true]
]) {
  const png = encodePNG(size, (x, y, r) => draw(x, y, r, maskable));
  fs.writeFileSync(path.join(outDir, name), png);
  console.log('wrote', name, `${Math.round(png.length / 1024)} KB`);
}
