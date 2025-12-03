/**
 * PWA Icon Generator Script
 * Generates PNG icons from the SVG source for PWA manifest
 * 
 * Run: npm run generate-icons
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// SVG icon with embedded styles (works better for conversion)
const createSvgIcon = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="eco" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <g transform="translate(256, 256)" fill="none" stroke="url(#eco)" stroke-width="28" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-80,-100 L0,-100 L40,-40" />
    <polygon points="50,-60 70,-20 30,-20" fill="url(#eco)" stroke="none"/>
    <path d="M80,20 L40,100 L-40,100" />
    <polygon points="-50,80 -70,120 -30,120" fill="url(#eco)" stroke="none" transform="rotate(180, -50, 100)"/>
    <path d="M-40,60 L-80,-20 L-40,-80" />
    <polygon points="-30,-90 -50,-130 -10,-130" fill="url(#eco)" stroke="none" transform="rotate(60, -40, -100)"/>
  </g>
  <ellipse cx="256" cy="256" rx="30" ry="50" fill="#10b981" opacity="0.8" transform="rotate(-45, 256, 256)"/>
  <rect x="100" y="420" width="312" height="4" rx="2" fill="#06b6d4" opacity="0.6"/>
  <rect x="140" y="435" width="232" height="3" rx="1.5" fill="#06b6d4" opacity="0.4"/>
</svg>`;

// Simple PNG creation using base64 encoded minimal PNG for fallback
// For production, you should use sharp or canvas libraries
const createPlaceholderPng = (size) => {
  // This creates a simple colored PNG - for best results use sharp library
  console.log(`Note: For production-quality icons, install 'sharp' package and update this script`);
  return createSvgIcon(size);
};

async function generateIcons() {
  console.log('🎨 Generating PWA icons...\n');

  const sizes = [
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
    { name: 'apple-touch-icon.png', size: 180 },
  ];

  // Check if sharp is available for PNG generation
  let sharp;
  try {
    sharp = (await import('sharp')).default;
    console.log('✅ Using sharp for high-quality PNG generation\n');
  } catch {
    console.log('⚠️  sharp not installed. Creating SVG files instead.');
    console.log('   Run: npm install sharp --save-dev\n');
  }

  for (const { name, size } of sizes) {
    const outputPath = path.join(PUBLIC_DIR, name);
    const svgContent = createSvgIcon(size);

    if (sharp) {
      // Generate actual PNG using sharp
      try {
        await sharp(Buffer.from(svgContent))
          .resize(size, size)
          .png()
          .toFile(outputPath);
        console.log(`✅ Generated ${name} (${size}x${size})`);
      } catch (err) {
        console.error(`❌ Failed to generate ${name}:`, err.message);
      }
    } else {
      // Create SVG file as fallback (rename to .png for manifest compatibility)
      // Modern browsers handle this, but for better compatibility install sharp
      const svgPath = outputPath.replace('.png', '.svg');
      fs.writeFileSync(svgPath, svgContent);
      console.log(`✅ Generated ${name.replace('.png', '.svg')} (${size}x${size}) - SVG fallback`);
    }
  }

  console.log('\n🎉 Icon generation complete!');
  console.log('\n📝 For production, ensure you have proper PNG icons by:');
  console.log('   1. npm install sharp --save-dev');
  console.log('   2. npm run generate-icons');
}

generateIcons().catch(console.error);


