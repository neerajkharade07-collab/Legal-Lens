/**
 * Local production preview: serves .vercel/output/static exactly like Vercel
 * (main site at /, drafting app at /legal-drafting/) and proxies /api to the
 * backend. Run `npm run build` first.
 *
 *   npm start                      → http://localhost:4173
 *   LEGAL_LENS_API_ORIGIN=http://localhost:5000 (default)
 *
 * Port 4173 is already in the backend's CORS allow-list.
 */
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATIC = path.join(ROOT, '.vercel', 'output', 'static');
const PORT = Number(process.env.PORT) || 4173;
const API = new URL((process.env.LEGAL_LENS_API_ORIGIN || 'http://localhost:5000').replace(/\/+$/, ''));

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

if (!fs.existsSync(path.join(STATIC, 'index.html'))) {
  console.error('Nothing to serve — run `npm run build` first.');
  process.exit(1);
}

function sendFile(res, file) {
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

function proxy(req, res) {
  const client = API.protocol === 'https:' ? https : http;
  const upstream = client.request(
    {
      protocol: API.protocol,
      hostname: API.hostname,
      port: API.port || (API.protocol === 'https:' ? 443 : 80),
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: API.host },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  upstream.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: `Legal Lens backend not reachable at ${API.origin}.` }));
  });
  req.pipe(upstream);
}

http
  .createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname.startsWith('/api/')) return proxy(req, res);
    if (pathname === '/legal-drafting') {
      res.writeHead(308, { Location: '/legal-drafting/' });
      return res.end();
    }
    const candidate = path.normalize(path.join(STATIC, pathname === '/' ? 'index.html' : pathname));
    if (!candidate.startsWith(STATIC)) {
      res.writeHead(403);
      return res.end();
    }
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return sendFile(res, candidate);
    if (fs.existsSync(path.join(candidate, 'index.html'))) return sendFile(res, path.join(candidate, 'index.html'));
    if (pathname.startsWith('/legal-drafting/')) return sendFile(res, path.join(STATIC, 'legal-drafting', 'index.html'));
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  })
  .listen(PORT, () => {
    console.log(`Legal Lens (main site + Legal Drafting V2): http://localhost:${PORT}`);
    console.log(`API proxied to ${API.origin}/api`);
  });
