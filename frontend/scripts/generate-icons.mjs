/**
 * Generate PWA icons from the Footix logo using sharp.
 * Run: node scripts/generate-icons.mjs
 */
import sharp from "sharp";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "../public/logo-footix.png");
const outDir = join(__dirname, "../public/icons");

const sizes = [
  { name: "icon-192.png", size: 192, padding: 0 },
  { name: "icon-512.png", size: 512, padding: 0 },
  { name: "icon-maskable-192.png", size: 192, padding: 0.2 },
  { name: "icon-maskable-512.png", size: 512, padding: 0.2 },
];

for (const { name, size, padding } of sizes) {
  const padPixels = Math.round(size * padding);
  const inner = size - padPixels * 2;

  await sharp(src)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .extend({
      top: padPixels,
      bottom: padPixels,
      left: padPixels,
      right: padPixels,
      background:
        padding > 0
          ? { r: 22, g: 163, b: 74, alpha: 1 } // primary green for maskable
          : { r: 0, g: 0, b: 0, alpha: 0 }, // transparent for regular
    })
    .png()
    .toFile(join(outDir, name));
  console.log(`✓ ${name}`);
}

console.log("Done — all icons generated.");
