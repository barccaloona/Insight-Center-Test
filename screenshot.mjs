import puppeteer from './node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, 'temporary screenshots');
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const url   = process.argv[2] || 'http://localhost:3002';
const label = process.argv[3] ? `-${process.argv[3]}` : '';

const existing = readdirSync(dir).filter(f => f.startsWith('screenshot-') && f.endsWith('.png'));
const nums = existing.map(f => parseInt(f.match(/screenshot-(\d+)/)?.[1] || '0')).filter(Boolean);
const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
const outFile = join(dir, `screenshot-${next}${label}.png`);

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
// Scroll through the page to trigger all reveal animations
await page.evaluate(async () => {
  const totalHeight = document.body.scrollHeight;
  const step = 400;
  for (let y = 0; y < totalHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise(r => setTimeout(r, 80));
  }
  window.scrollTo(0, 0);
});
await new Promise(r => setTimeout(r, 600));
await page.screenshot({ path: outFile, fullPage: true });
await browser.close();

console.log(`Screenshot saved: ${outFile}`);
