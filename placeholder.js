function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

function hsl(h, s, l) {
  return `hsl(${h % 360}, ${s}%, ${l}%)`;
}

function escXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapText(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxLen && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function generatePlaceholderSvg({ name = 'Mahsulot', scent = '', size = '' } = {}) {
  const hue = hashStr(scent || name) % 360;
  const bg = hsl(hue, 15, 94);
  const bgLight = hsl(hue, 12, 97);
  const accent = hsl(hue, 25, 55);
  const accentSoft = hsl(hue, 20, 70);
  const stroke = '#c8c8c4';
  const textMuted = '#737373';

  const titleLines = wrapText(name, 16);
  const titleY = titleLines.length > 1 ? 218 : 224;

  const titleSvg = titleLines
    .map((line, i) => `<tspan x="150" dy="${i === 0 ? 0 : 16}">${escXml(line)}</tspan>`)
    .join('');

  const scentLabel = scent ? escXml(scent) : '';
  const sizeLabel = size ? escXml(size) : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${bgLight}"/>
      <stop offset="100%" stop-color="${bg}"/>
    </linearGradient>
    <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${accentSoft}" stop-opacity="0.7"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="300" height="400" fill="url(#bg)" rx="16"/>
  <circle cx="150" cy="130" r="70" fill="${accent}" opacity="0.12" filter="url(#glow)"/>
  <rect x="118" y="72" width="64" height="18" rx="6" fill="#ffffff" stroke="${stroke}" stroke-width="1.5" opacity="0.9"/>
  <rect x="108" y="88" width="12" height="10" rx="3" fill="${stroke}" opacity="0.5"/>
  <rect x="180" y="88" width="12" height="10" rx="3" fill="${stroke}" opacity="0.5"/>
  <rect x="122" y="90" width="56" height="150" rx="14" fill="#ffffff" stroke="${stroke}" stroke-width="1.5" opacity="0.95"/>
  <rect x="128" y="110" width="44" height="115" rx="10" fill="url(#liquid)"/>
  <ellipse cx="150" cy="110" rx="22" ry="6" fill="${accent}" opacity="0.6"/>
  <text x="150" y="268" text-anchor="middle" fill="${accent}" font-family="Georgia, serif" font-size="13" font-weight="600">${scentLabel}</text>
  <text x="150" y="290" text-anchor="middle" fill="${textMuted}" font-family="Arial, sans-serif" font-size="12">${sizeLabel}</text>
  <text x="150" y="${titleY}" text-anchor="middle" fill="#1c1c1c" font-family="Arial, sans-serif" font-size="11" font-weight="500">${titleSvg}</text>
</svg>`;
}

function findVariantByImage(products, filename) {
  const paths = [`images/${filename}`, filename];
  for (const product of products) {
    for (const variant of product.variants || []) {
      if (paths.some((p) => variant.image === p || variant.image?.endsWith(filename))) {
        return { product, variant };
      }
    }
  }
  return null;
}

module.exports = { generatePlaceholderSvg, findVariantByImage };
