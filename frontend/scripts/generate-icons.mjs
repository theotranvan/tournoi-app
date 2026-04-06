/**
 * Generate simple PWA icons (solid green squares with "⚽" emoji).
 * Uses Node's zlib for PNG compression — no external dependencies.
 * Run: node scripts/generate-icons.mjs
 */
import { writeFileSync, mkdirSync } from "fs";
import { deflateSync } from "zlib";

function createPNG(size, r, g, b) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); // width
  ihdr.writeUInt32BE(size, 4); // height
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type (RGB)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Pixel data: each row starts with filter byte (0 = none)
  const rowSize = 1 + size * 3; // filter byte + RGB pixels
  const rawData = Buffer.alloc(rowSize * size);

  // Draw a subtle rounded square with darker border
  const borderWidth = Math.max(2, Math.floor(size * 0.04));
  const cornerRadius = Math.floor(size * 0.18);

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const px = rowOffset + 1 + x * 3;

      // Check if pixel is inside rounded rect
      const inCorner = isInRoundedCorner(x, y, size, cornerRadius);
      if (!inCorner) {
        // Outside rounded corners — transparent (use background)
        rawData[px] = 10; // #0a0a0a background
        rawData[px + 1] = 10;
        rawData[px + 2] = 10;
        continue;
      }

      // Check if on border
      const innerInCorner = isInRoundedCorner(
        x - borderWidth, y - borderWidth,
        size - borderWidth * 2, cornerRadius - borderWidth,
        borderWidth
      );
      if (!innerInCorner) {
        // Border area — darker green
        rawData[px] = 21; // #15803d
        rawData[px + 1] = 128;
        rawData[px + 2] = 61;
        continue;
      }

      // Interior — gradient effect (slightly lighter at center)
      const cx = size / 2, cy = size / 2;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / (size / 2);
      const factor = 1 - dist * 0.15;
      rawData[px] = Math.min(255, Math.round(r * factor));
      rawData[px + 1] = Math.min(255, Math.round(g * factor));
      rawData[px + 2] = Math.min(255, Math.round(b * factor));
    }
  }

  const compressed = deflateSync(rawData);

  function makeChunk(type, data) {
    const buf = Buffer.alloc(4 + type.length + data.length + 4);
    buf.writeUInt32BE(data.length, 0);
    buf.write(type, 4);
    data.copy(buf, 8);
    // CRC32
    const crcData = Buffer.concat([Buffer.from(type), data]);
    buf.writeUInt32BE(crc32(crcData) >>> 0, 8 + data.length);
    return buf;
  }

  return Buffer.concat([
    signature,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", compressed),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

function isInRoundedCorner(x, y, size, radius, offset = 0) {
  const s = size + offset * 2;
  const px = x + offset;
  const py = y + offset;
  if (px < 0 || py < 0 || px >= s || py >= s) return false;

  // Check corners
  if (px < radius && py < radius) {
    return (px - radius) ** 2 + (py - radius) ** 2 <= radius ** 2;
  }
  if (px >= s - radius && py < radius) {
    return (px - (s - radius - 1)) ** 2 + (py - radius) ** 2 <= radius ** 2;
  }
  if (px < radius && py >= s - radius) {
    return (px - radius) ** 2 + (py - (s - radius - 1)) ** 2 <= radius ** 2;
  }
  if (px >= s - radius && py >= s - radius) {
    return (px - (s - radius - 1)) ** 2 + (py - (s - radius - 1)) ** 2 <= radius ** 2;
  }
  return true;
}

// CRC32 lookup table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc ^ 0xffffffff;
}

// Generate icons
mkdirSync("public/icons", { recursive: true });

const green = [22, 163, 74]; // #16a34a

for (const size of [192, 512]) {
  const png = createPNG(size, ...green);
  writeFileSync(`public/icons/icon-${size}.png`, png);
  console.log(`✓ icon-${size}.png (${png.length} bytes)`);
}

console.log("Done!");
