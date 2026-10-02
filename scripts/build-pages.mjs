/**
 * Build de la demo estática para GitHub Pages → dist-pages/
 *
 *   REPO_URL=https://github.com/<usuario>/la-nutria npm run pages:build
 *
 * PAGES_BASE define la ruta bajo la que se publica (por defecto /la-nutria/).
 */
import { execFileSync } from 'node:child_process';
import { copyFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const base = process.env.PAGES_BASE ?? '/la-nutria/';
const out = `${root}dist-pages`;
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', cwd: root, ...opts });

if (!process.argv.includes('--skip-snapshot')) run(process.execPath, ['scripts/snapshot-demo.mjs']);

// Vite se ejecuta con node directamente (rutas con espacios, sin shell).
run(process.execPath, [`${root}node_modules/vite/bin/vite.js`, 'build', '--base', base, '--outDir', out, '--emptyOutDir'], {
  cwd: `${root}client`,
  env: { ...process.env, VITE_STATIC_DEMO: 'true' },
});

await copyFile(`${root}client/.pages/demo-api.json`, `${out}/demo-api.json`);
// GitHub Pages no conoce las rutas de la SPA: 404.html = index.html permite
// abrir enlaces directos como /la-nutria/pacientes/123.
await copyFile(`${out}/index.html`, `${out}/404.html`);
await writeFile(`${out}/.nojekyll`, '');
console.log(`\nDemo estática lista en dist-pages/ (base ${base})`);
