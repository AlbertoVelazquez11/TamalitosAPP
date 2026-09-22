// generate-icons.js
// Genera iconos PNG válidos y SVG sin dependencias externas usando zlib nativo de Node.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[i] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function createPng(width, height, getPixel) {
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type: 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const idatData = zlib.deflateSync(rawData, { level: 9 });

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crcVal = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crcVal, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8 bits por canal
  ihdr[9] = 6; // Color type: RGBA
  ihdr[10] = 0; // Compresión deflate
  ihdr[11] = 0; // Filtro estándar
  ihdr[12] = 0; // Sin entrelazado

  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idatData),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

// Dibuja un degradado violeta/azul oscuro con un rayo estilizado en el centro
function appIconPixel(x, y, w, h) {
  const nx = x / w;
  const ny = y / h;

  // Fondo con degradado diagonal (#0f172a a #312e81)
  const grad = (nx + ny) * 0.5;
  let r = Math.round(15 + grad * 34);
  let g = Math.round(23 + grad * 23);
  let b = Math.round(42 + grad * 87);

  // Distancia al centro normalizada (-1 a 1)
  const cx = (x - w / 2) / (w / 2);
  const cy = (y - h / 2) / (h / 2);

  // Dibuja un círculo interior brillante
  const dist = Math.sqrt(cx * cx + cy * cy);
  if (dist < 0.72) {
    // Halo suave
    const factor = (1 - dist / 0.72) * 0.4;
    r = Math.min(255, Math.round(r + 79 * factor));
    g = Math.min(255, Math.round(g + 70 * factor));
    b = Math.min(255, Math.round(b + 229 * factor));
  }

  // Geometría de un rayo en el centro
  // Coordenadas relativas de -0.5 a 0.5
  const lx = cx;
  const ly = cy;
  let inLightning = false;

  // Segmento superior del rayo
  if (ly >= -0.55 && ly <= 0.05) {
    const minX = -0.15 + ly * 0.25;
    const maxX = 0.25 + ly * 0.25;
    if (lx >= minX && lx <= maxX) inLightning = true;
  }
  // Segmento inferior del rayo
  if (ly >= -0.05 && ly <= 0.55) {
    const minX = -0.28 + ly * 0.35;
    const maxX = 0.12 + ly * 0.35;
    if (lx >= minX && lx <= maxX) inLightning = true;
  }

  if (inLightning) {
    // Rayo amarillo-blanco resplandeciente (#38bdf8 a #ffffff)
    const vertFactor = (ly + 0.55) / 1.1;
    r = Math.round(255);
    g = Math.round(200 + vertFactor * 55);
    b = Math.round(50 + vertFactor * 100);
  }

  return [r, g, b, 255]; // Opaque para evitar bordes negros en iOS
}

// 1. Icono 192x192
const png192 = createPng(192, 192, appIconPixel);
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), png192);
console.log('Generado: icons/icon-192.png');

// 2. Icono 512x512
const png512 = createPng(512, 512, appIconPixel);
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), png512);
console.log('Generado: icons/icon-512.png');

// 3. Apple Touch Icon 180x180 (resolución estándar de iOS)
const png180 = createPng(180, 180, appIconPixel);
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), png180);
console.log('Generado: icons/apple-touch-icon.png');

// 4. Icono SVG vectorial
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#312e81" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#4f46e5" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#4f46e5" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" rx="115" fill="url(#bgGrad)" />
  <circle cx="256" cy="256" r="190" fill="url(#glow)" />
  <!-- Rayo Offline PWA -->
  <polygon points="285,75 140,270 240,270 205,437 372,225 260,225" fill="#facc15" stroke="#fef08a" stroke-width="8" stroke-linejoin="round"/>
</svg>`;
fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgContent);
console.log('Generado: icons/icon.svg');

