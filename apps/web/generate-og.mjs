import { renderAsync } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = resolve(__dirname, 'public/og-image.svg');
const pngPath = resolve(__dirname, 'public/og-image.png');

const svg = readFileSync(svgPath, 'utf-8');

const png = await renderAsync(svg, {
  width: 1200,
  height: 630,
  fitTo: { mode: 'width', value: 1200 },
});

writeFileSync(pngPath, png.asPng());
console.log('✓ og-image.png generated (1200x630)');
