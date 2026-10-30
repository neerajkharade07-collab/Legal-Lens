/**
 * Two local servers in one script.
 *
 * 1) Local production preview (unchanged): serves .vercel/output/static exactly
 *    like Vercel (main site at /, drafting app at /legal-drafting/) and proxies
 *    /api to the backend. Run `npm run build` first.
 *
 *      npm start                      → http://localhost:4173
 *      LEGAL_LENS_API_ORIGIN=http://localhost:5000 (default)
 *
 *    Port 4173 is already in the backend's CORS allow-list.
 *
 * 2) Local static site with React refresh support (`--dev`, Phase 1 fix): a
 *    drop-in replacement for VS Code Live Preview that serves THIS folder as it
 *    is (no build step), at the same address:
 *
 *      npm run dev:site               → http://127.0.0.1:3000/<this folder's name>/
 *      e.g. http://127.0.0.1:3000/LegalLens-Claude-For-Upload/legal-drafting/
 *
 *    - Every existing file is served as it is (HTML pages, CSS, JS, images…).
 *    - A page address inside legal-drafting/ that is not a file (for example
 *      legal-drafting/draft/<id> or legal-drafting/documents) returns
 *      legal-drafting/index.html, so a refresh opens the React app on that page.
 *      Missing files WITH an extension (a missing .js/.css/.png) stay 404 — they
 *      are never answered with HTML.
 *      The app's index.html is sent with <base href="…/legal-drafting/"> added, the
 *      same base the page sets for itself, so its relative ./assets URLs work.
 *    - The site also answers without the folder prefix (http://127.0.0.1:3000/).
 *      Use SITE_PATH_PREFIX to change the prefix ("" for none).
 *    - Listens on 127.0.0.1 only. Never serves node_modules or dot-files/folders
 *      (.env, .git, .vercel, backups …).
 *    - /api is proxied to LEGAL_LENS_API_ORIGIN (default http://localhost:5000).
 *      The pages normally call http://127.0.0.1:5000/api directly on port 3000,
 *      exactly as under Live Preview; the proxy only helps builds that use "/api".
 *    PORT changes the port (default 3000 — already in the backend's CORS list).
 */
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEV = process.argv.includes('--dev');
const STATIC = path.join(ROOT, '.vercel', 'output', 'static');
const PORT = Number(process.env.PORT) || (DEV ? 3000 : 4173);
const API = new URL((process.env.LEGAL_LENS_API_ORIGIN || 'http://localhost:5000').replace(/\/+$/, ''));

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

if (!DEV && !fs.existsSync(path.join(STATIC, 'index.html'))) {
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

// ---------------------------------------------------------------- 1) production preview
function previewHandler(req, res) {
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
}

// ---------------------------------------------------------------- 2) local static site (--dev)
const DEV_TYPES = {
  ...TYPES,
  '.mjs': 'text/javascript; charset=utf-8', '.map': 'application/json', '.woff': 'font/woff',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.pdf': 'application/pdf', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.xml': 'application/xml', '.md': 'text/plain; charset=utf-8',
  '.avif': 'image/avif', '.wasm': 'application/wasm',
};
const PREFIX = (() => {
  const raw = process.env.SITE_PATH_PREFIX ?? path.basename(ROOT);
  const trimmed = String(raw).replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '';
})();
const APP_DIR = 'legal-drafting';
const BLOCKED_SEGMENTS = new Set(['node_modules']);

function devSend(req, res, status, file, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': DEV_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

/**
 * The React app's index.html with <base href="…/legal-drafting/"> added right
 * after <head>. The page's own inline script sets the same base, but only once it
 * runs; having it in the markup also stops the browser's preloader from first
 * requesting …/draft/assets/… (harmless 404s in the console).
 */
function devSendAppIndex(req, res, file, mount) {
  let html = fs.readFileSync(file, 'utf8');
  if (!/<base\s/i.test(html)) html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}<base href="${mount}/${APP_DIR}/">`);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
  res.end(req.method === 'HEAD' ? undefined : html);
}

function devText(res, status, text, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache', ...headers });
  res.end(text);
}

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function devHandler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return devText(res, 400, 'Bad request');
  }
  if (pathname.startsWith('/api/')) return proxy(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') return devText(res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
  if (pathname.includes('\0') || pathname.includes('\\')) return devText(res, 400, 'Bad request');

  // Optional folder prefix (/LegalLens-Claude-For-Upload/…), like Live Preview.
  let mount = '';
  if (PREFIX && pathname === PREFIX) {
    res.writeHead(308, { Location: `${PREFIX}/${url.search}` });
    return res.end();
  }
  if (PREFIX && pathname.startsWith(`${PREFIX}/`)) {
    mount = PREFIX;
    pathname = pathname.slice(PREFIX.length);
  }

  const segments = pathname.split('/').filter(Boolean);
  if (segments.some((s) => s.startsWith('.') || BLOCKED_SEGMENTS.has(s))) return devText(res, 404, 'Not found');

  const target = path.resolve(ROOT, `.${pathname}`);
  const rel = path.relative(ROOT, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return devText(res, 403, 'Forbidden');

  const appIndex = path.join(ROOT, APP_DIR, 'index.html');
  if (isFile(target)) {
    return target === appIndex ? devSendAppIndex(req, res, target, mount) : devSend(req, res, 200, target);
  }
  if (isDir(target)) {
    if (!pathname.endsWith('/')) {
      res.writeHead(308, { Location: `${mount}${pathname}/${url.search}` });
      return res.end();
    }
    const index = path.join(target, 'index.html');
    if (index === appIndex && isFile(index)) return devSendAppIndex(req, res, index, mount);
    if (isFile(index)) return devSend(req, res, 200, index);
    return devText(res, 404, 'Not found');
  }

  // React app page (…/legal-drafting/draft/<id>, …/legal-drafting/documents …):
  // not a file and no file extension → the app's index.html.
  if (segments[0] === APP_DIR && segments.length > 1 && !path.extname(pathname)) {
    if (isFile(appIndex)) return devSendAppIndex(req, res, appIndex, mount);
    return devText(res, 404, `${APP_DIR}/index.html is missing — build the app and copy legal-drafting-app/dist to ${APP_DIR}/.`);
  }
  return devText(res, 404, 'Not found');
}

// ---------------------------------------------------------------- start
const server = http.createServer(DEV ? devHandler : previewHandler);
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use (is VS Code Live Preview still running?). Stop it or set PORT.`);
  } else {
    console.error(err.message);
  }
  process.exit(1);
});

if (DEV) {
  server.listen(PORT, '127.0.0.1', () => {
    const shown = `http://127.0.0.1:${PORT}${PREFIX}/`;
    console.log(`CASEONE site (this folder, no build): ${shown}`);
    console.log(`Legal Drafting (refresh-safe):        ${shown}${APP_DIR}/`);
    console.log(`API proxied at /api → ${API.origin}/api`);
  });
} else {
  server.listen(PORT, () => {
    console.log(`Legal Lens (main site + Legal Drafting V2): http://localhost:${PORT}`);
    console.log(`API proxied to ${API.origin}/api`);
  });
}
