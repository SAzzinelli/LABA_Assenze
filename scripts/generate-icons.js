// Script per generare icone PNG da SVG
// Richiede: npm install sharp (opzionale, altrimenti usa SVG)

const fs = require('fs');
const path = require('path');

// SVG template per icona grande
const iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#104a96;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1e5fb8;stop-opacity:1" />
    </linearGradient>
  </defs>
  <!-- Background con gradiente -->
  <rect width="1024" height="1024" fill="url(#grad)" rx="180"/>
  
  <!-- Lettera L stilizzata -->
  <path d="M 250 250 L 250 750 L 750 750 L 750 650 L 400 650 L 400 250 Z" fill="white" opacity="0.95"/>
  
  <!-- Accenti decorativi -->
  <circle cx="800" cy="250" r="60" fill="white" opacity="0.3"/>
  <circle cx="850" cy="350" r="40" fill="white" opacity="0.2"/>
</svg>`;

// Salva SVG grande
const publicDir = path.join(__dirname, '../client/public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Crea icona grande per Safari
const iconPath = path.join(publicDir, 'icon-512x512.svg');
fs.writeFileSync(iconPath, iconSVG);

console.log('✅ Icona SVG 512x512 creata:', iconPath);
console.log('💡 Per convertire in PNG, usa un tool online come:');
console.log('   - https://cloudconvert.com/svg-to-png');
console.log('   - https://convertio.co/svg-png/');
console.log('   Oppure installa sharp: npm install sharp');

