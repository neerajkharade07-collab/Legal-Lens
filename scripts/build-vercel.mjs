/**
 * Builds the complete Legal Lens site for Vercel (Build Output API v3):
 *
 *   /                    main Legal Lens website (static HTML/CSS/JS, unchanged)
 *   /legal-drafting/     Legal Drafting Assistant V2 (React app in legal-drafting-app/)
 *   /api/*               proxied to the Legal Lens backend (LEGAL_LENS_API_ORIGIN)
 *
 * Serving everything from one origin keeps the backend's httpOnly refresh
 * cookie first-party (works in Safari / strict browsers) and needs no CORS
 * setup in the browser.
 *
 * Usage:  node scripts/build-vercel.mjs            (Vercel runs `npm run build`)
 *         node scripts/build-vercel.mjs --skip-app-build   (reuse legal-drafting-app/dist)
 * Env:    LEGAL_LENS_API_ORIGIN  e.g. https://legal-lens-api.onrender.com  (no /api, no secrets)
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(ROOT, 'legal-drafting-app');
const OUT = path.join(ROOT, '.vercel', 'output');
const STATIC = path.join(OUT, 'static');
const APP_BASE = 'legal-drafting';
const skipAppBuild = process.argv.includes('--skip-app-build');

// Top-level entries of the main site that are NOT part of the public website.
const EXCLUDE = new Set([
  'legal-drafting-app',
  'scripts',
  'node_modules',
  '.vercel',
  '.git',
  '.github',
  'backend',
  'package.json',
  'package-lock.json',
  'vercel.json',
  'README-DEPLOY.md',
  '.gitignore',
  '.vercelignore',
  '.env',
  '.env.example',
]);

function log(message) {
  console.log(`[build] ${message}`);
}

function run(command, args, cwd) {
  log(`${command} ${args.join(' ')}  (in ${path.relative(ROOT, cwd) || '.'})`);
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    console.error(`[build] "${command} ${args.join(' ')}" failed.`);
    process.exit(result.status || 1);
  }
}

// ---- 1. backend origin (for the /api proxy) ----
const apiOrigin = (process.env.LEGAL_LENS_API_ORIGIN || '')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

if (apiOrigin && !/^https?:\/\/[^/]+$/.test(apiOrigin)) {
  console.error(`[build] LEGAL_LENS_API_ORIGIN must look like https://your-backend.example.com (got "${apiOrigin}").`);
  process.exit(1);
}
if (!apiOrigin) {
  if (process.env.VERCEL) {
    console.error(
      '[build] LEGAL_LENS_API_ORIGIN is not set. Add it in Vercel → Project → Settings → Environment Variables\n' +
        '        (the public URL of your Legal Lens backend, e.g. https://legal-lens-api.onrender.com).',
    );
    process.exit(1);
  }
  log('LEGAL_LENS_API_ORIGIN not set — /api will not be proxied by this build (fine for `npm start`, which proxies itself).');
}

// ---- 2. build the Legal Drafting Assistant V2 ----
if (!skipAppBuild) {
  if (!fs.existsSync(path.join(APP, 'node_modules'))) {
    run('npm', [fs.existsSync(path.join(APP, 'package-lock.json')) ? 'ci' : 'install'], APP);
  }
  run('npm', ['run', 'build'], APP);
}
const appDist = path.join(APP, 'dist');
if (!fs.existsSync(path.join(appDist, 'index.html'))) {
  console.error('[build] legal-drafting-app/dist/index.html is missing — the app build did not run.');
  process.exit(1);
}

// ---- 3. assemble .vercel/output/static ----
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(STATIC, { recursive: true });

for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (EXCLUDE.has(entry.name) || entry.name.startsWith('.')) continue;
  fs.cpSync(path.join(ROOT, entry.name), path.join(STATIC, entry.name), { recursive: true });
}
fs.cpSync(appDist, path.join(STATIC, APP_BASE), { recursive: true });
log(`main site + ${APP_BASE}/ copied to .vercel/output/static`);

// ---- 4. routing ----
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

const routes = [
  // Backend API on the same origin (keeps the refresh cookie first-party).
  ...(apiOrigin ? [{ src: '^/api/(.*)$', dest: `${apiOrigin}/api/$1` }] : []),
  { src: '^/(.*)$', headers: securityHeaders, continue: true },
  {
    src: `^/${APP_BASE}/assets/(.*)$`,
    headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
    continue: true,
  },
  { src: `^/${APP_BASE}$`, status: 308, headers: { Location: `/${APP_BASE}/` } },
  { src: '^/$', dest: '/index.html' },
  { handle: 'filesystem' },
  // Client-side routes of the drafting app (/legal-drafting/documents, /legal-drafting/draft/:id, …)
  { src: `^/${APP_BASE}/(.*)$`, dest: `/${APP_BASE}/index.html` },
];

fs.writeFileSync(path.join(OUT, 'config.json'), JSON.stringify({ version: 3, routes }, null, 2));
log(`done → .vercel/output (API proxy: ${apiOrigin ? `${apiOrigin}/api` : 'none'})`);
