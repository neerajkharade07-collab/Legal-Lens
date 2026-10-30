/**
 * Runs the Legal Drafting unit tests (tests/*.test.js) with Node's test runner.
 * The sources use Vite-style imports (no file extensions), so each test file is
 * first bundled with esbuild — already installed as part of Vite. Nothing is
 * written into src/; the bundles go to a temporary folder.
 *
 *   npm run test:phase1
 *   ESBUILD_PATH=/path/to/esbuild node tests/run-tests.mjs   (use another esbuild)
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const esbuild = require(process.env.ESBUILD_PATH || 'esbuild');

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'legal-drafting-tests-'));
const files = fs.readdirSync(here).filter((f) => f.endsWith('.test.js'));
const bundles = [];
for (const f of files) {
  const outfile = path.join(out, f.replace(/\.js$/, '.mjs'));
  await esbuild.build({
    entryPoints: [path.join(here, f)],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    logLevel: 'error',
    define: { 'import.meta.env': '{}' },
    // Node built-ins stay external; the services under test use no npm packages.
    external: ['node:*'],
  });
  bundles.push(outfile);
}
const run = spawnSync(process.execPath, ['--test', ...bundles], { stdio: 'inherit' });
fs.rmSync(out, { recursive: true, force: true });
process.exit(run.status ?? 1);
