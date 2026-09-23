import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The Legal Drafting Assistant is served by the main Legal Lens site under
 * /legal-drafting/ (see the project root's scripts/build-vercel.mjs), so the
 * app is built for that base path.
 *
 * API calls go to the same origin (/api). In development Vite proxies /api to
 * the Legal Lens backend (default http://localhost:5000), which keeps the
 * refresh-token cookie first-party exactly like production.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const apiTarget = env.DEV_API_PROXY_TARGET || 'http://localhost:5000';
  const proxy = { '/api': { target: apiTarget, changeOrigin: false } };

  return {
    base: './',
    plugins: [react()],
    server: {
      port: 5173,
      open: '/legal-drafting/',
      proxy,
    },
    preview: {
      port: 4173,
      proxy,
    },
  };
});
