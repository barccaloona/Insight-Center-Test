import puppeteer from './node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, 'temporary screenshots');
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const url     = process.argv[2] || 'http://localhost:3002';
const section = process.argv[3] || 'hero';

const existing = readdirSync(dir).filter(f => f.startsWith('screenshot-') && f.endsWith('.png'));
const nums = existing.map(f => parseInt(f.match(/screenshot-(\d+)/)?.[1] || '0')).filter(Boolean);
const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
const outFile = join(dir, `screenshot-${next}-${section}.png`);

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

// Scroll through to trigger all animations
await page.evaluate(async () => {
  const totalHeight = document.body.scrollHeight;
  const step = 400;
  for (let y = 0; y < totalHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise(r => setTimeout(r, 60));
  }
});
await new Promise(r => setTimeout(r, 400));

// Scroll to target section
await page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (el) el.scrollIntoView({ block: 'start' });
}, `#${section}`);
await new Promise(r => setTimeout(r, 400));

await page.screenshot({ path: outFile, fullPage: false });
await browser.close();
console.log(`Screenshot saved: ${outFile}`);
