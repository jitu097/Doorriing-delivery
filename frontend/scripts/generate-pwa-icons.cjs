/**
 * generate-pwa-icons.cjs
 *
 * Resizes public/Doorriing-delivery.png into the three PNG variants
 * required by the PWA manifest and TWA tooling.
 *
 * Outputs:
 *   public/icons/icon-192.png           192x192  transparent bg
 *   public/icons/icon-512.png           512x512  transparent bg
 *   public/icons/icon-maskable-512.png  512x512  orange bg + logo centred at 80%
 *
 * Usage:  npm run pwa:icons
 */

'use strict';

const path  = require('path');
const fs    = require('fs');
const sharp = require('sharp');

const src    = path.join(__dirname, '..', 'public', 'Doorriing-delivery.png');
const outDir = path.join(__dirname, '..', 'public', 'icons');

if (!fs.existsSync(src)) {
  console.error('ERROR: Source image not found:', src);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const BRAND_BG = { r: 255, g: 102, b: 0, alpha: 1 };

async function run() {
  for (const size of [192, 512]) {
    const out = path.join(outDir, `icon-${size}.png`);
    await sharp(src)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(out);
    console.log(`  done  icon-${size}.png  (${size}x${size})`);
  }

  const MASK_SIZE  = 512;
  const LOGO_SIZE  = Math.round(MASK_SIZE * 0.72);
  const OFFSET     = Math.round((MASK_SIZE - LOGO_SIZE) / 2);

  const logoBuffer = await sharp(src)
    .resize(LOGO_SIZE, LOGO_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const maskable = path.join(outDir, 'icon-maskable-512.png');
  await sharp({
    create: { width: MASK_SIZE, height: MASK_SIZE, channels: 4, background: BRAND_BG },
  })
    .composite([{ input: logoBuffer, top: OFFSET, left: OFFSET }])
    .png()
    .toFile(maskable);

  console.log(`  done  icon-maskable-512.png  (${MASK_SIZE}x${MASK_SIZE})`);
  console.log('\nPWA icons generated from Doorriing-delivery.png');
}

run().catch((err) => {
  console.error('Icon generation failed:', err.message);
  process.exit(1);
});
