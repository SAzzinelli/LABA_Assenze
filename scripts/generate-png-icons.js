// Script per generare icone PNG da SVG
// Richiede: npm install sharp (come dev dependency)

const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('❌ Sharp non installato. Installa con: npm install sharp --save-dev');
  console.log('💡 Alternativa: usa un tool online come https://cloudconvert.com/svg-to-png');
  process.exit(1);
}

const publicDir = path.join(__dirname, '../client/public');
const svgPath = path.join(publicDir, 'icon-512x512.svg');

if (!fs.existsSync(svgPath)) {
  console.error('❌ File SVG non trovato:', svgPath);
  process.exit(1);
}

const sizes = [
  { size: 16, name: 'favicon-16x16.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 512, name: 'icon-512x512.png' }
];

async function generatePNGs() {
  console.log('🔄 Generando icone PNG da SVG...');
  
  for (const { size, name } of sizes) {
    try {
      const outputPath = path.join(publicDir, name);
      await sharp(svgPath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✅ Creato: ${name} (${size}x${size})`);
    } catch (error) {
      console.error(`❌ Errore creando ${name}:`, error.message);
    }
  }
  
  console.log('✅ Tutte le icone PNG generate!');
}

generatePNGs().catch(console.error);

