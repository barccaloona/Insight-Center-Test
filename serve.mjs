import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3002;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0]; // strip query string

  // Proxy /api/rss → Substack feed (mirrors api/rss.js for local dev)
  if (urlPath === '/api/rss') {
    try {
      const upstream = await fetch('https://girardmiller.substack.com/feed', {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InsightCenter/1.0)' },
      });
      const xml = await upstream.text();
      res.writeHead(upstream.ok ? 200 : 502, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
      res.end(xml);
    } catch (err) {
      res.writeHead(502);
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }
  let filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`Serving at http://localhost:${PORT}`);
});
