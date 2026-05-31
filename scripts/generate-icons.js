#!/usr/bin/env node
// Generates all PWA icon PNGs (plus iOS apple-touch-icon and a splash
// screen) from the master brand artwork at
// public/brand/myforeman-icon-1024.png. Run once after the artwork
// changes:
//
//   npm install --save-dev sharp
//   node scripts/generate-icons.js
//
// The output PNGs are committed to public/icons/ so production
// deployments don't need sharp at build time.

const fs   = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC      = path.join(__dirname, '..', 'public', 'brand', 'myforeman-icon-1024.png');
const OUT_DIR  = path.join(__dirname, '..', 'public', 'icons');
const SPLASH_DIR = path.join(__dirname, '..', 'public', 'splash');

const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];

// Maskable icons need ~20% safe-zone padding inside a square. We do
// that by scaling the source to 60% and placing it on a #4f9eff bg.
const maskableSizes = [192, 512];

// Splash: dark #111827 with the icon centered.
const splashSizes = [
  { w: 750,  h: 1334 }, // iPhone SE / 6/7/8
  { w: 1125, h: 2436 }, // iPhone X / 11 Pro / 12 mini
  { w: 1170, h: 2532 }, // iPhone 12/13/14
  { w: 1284, h: 2778 }, // iPhone 12/13/14 Plus
  { w: 1290, h: 2796 }, // iPhone 14 Pro Max
];

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Source not found: ${SRC}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(SPLASH_DIR, { recursive: true });

  const svg = fs.readFileSync(SRC);

  // Standard icons (matches manifest "purpose: any")
  for (const size of sizes) {
    const out = path.join(OUT_DIR, `icon-${size}.png`);
    await sharp(svg).resize(size, size).png().toFile(out);
    console.log(`  wrote ${path.relative(process.cwd(), out)}`);
  }

  // Maskable icons — source already has plenty of padding around the
  // hat glyph, but render a tiny bit smaller and composite over a
  // solid blue background to be extra safe.
  for (const size of maskableSizes) {
    const inner = Math.round(size * 0.78);
    const margin = Math.round((size - inner) / 2);
    const out = path.join(OUT_DIR, `icon-${size}-maskable.png`);
    const innerPng = await sharp(svg).resize(inner, inner).png().toBuffer();
    await sharp({
      create: { width: size, height: size, channels: 4, background: '#4f9eff' },
    })
      .composite([{ input: innerPng, top: margin, left: margin }])
      .png()
      .toFile(out);
    console.log(`  wrote ${path.relative(process.cwd(), out)}`);
  }

  // iOS splash — icon centered at ~30% of width, on the dark app bg.
  for (const { w, h } of splashSizes) {
    const iconSize = Math.round(Math.min(w, h) * 0.3);
    const out = path.join(SPLASH_DIR, `splash-${w}x${h}.png`);
    const iconPng = await sharp(svg).resize(iconSize, iconSize).png().toBuffer();
    await sharp({
      create: { width: w, height: h, channels: 4, background: '#111827' },
    })
      .composite([{ input: iconPng, gravity: 'center' }])
      .png()
      .toFile(out);
    console.log(`  wrote ${path.relative(process.cwd(), out)}`);
  }

  // Favicons (top-level public/ so /favicon.ico resolves by default).
  // We emit two PNG favicons at 16 and 32 plus a 32px file at
  // favicon.ico — modern browsers accept a PNG inside a .ico
  // filename for single-image fallbacks.
  const publicDir = path.join(__dirname, '..', 'public');
  for (const size of [16, 32]) {
    const out = path.join(publicDir, `favicon-${size}x${size}.png`);
    await sharp(svg).resize(size, size).png().toFile(out);
    console.log(`  wrote ${path.relative(process.cwd(), out)}`);
  }
  const icoOut = path.join(publicDir, 'favicon.ico');
  await sharp(svg).resize(32, 32).png().toFile(icoOut);
  console.log(`  wrote ${path.relative(process.cwd(), icoOut)}`);

  console.log('\nDone. Generated', sizes.length + maskableSizes.length, 'icon files,', splashSizes.length, 'splash screens, and 3 favicons.');
}

main().catch(err => { console.error(err); process.exit(1); });
