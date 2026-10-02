/**
 * Publica dist-pages/ en la rama gh-pages del remoto `origin`.
 *
 *   npm run pages:deploy
 *
 * La rama gh-pages contiene SÓLO el sitio construido (historial propio).
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}dist-pages`;
const git = (args, cwd = out) => execFileSync('git', args, { cwd, stdio: 'inherit' });
const gitOut = (args, cwd = root) => execFileSync('git', args, { cwd }).toString().trim();

if (!existsSync(`${out}/index.html`)) throw new Error('Primero ejecuta: npm run pages:build');
const remote = gitOut(['remote', 'get-url', 'origin']);

await rm(`${out}/.git`, { recursive: true, force: true });
git(['init', '-q', '-b', 'gh-pages']);
git(['add', '-A']);
git(['-c', 'user.name=La Nutria Pages', '-c', 'user.email=pages@lanutria.local', 'commit', '-q', '-m', 'Demo estática de La Nutria']);
git(['push', '-f', remote, 'gh-pages']);
await rm(`${out}/.git`, { recursive: true, force: true });
console.log('Publicado en la rama gh-pages.');
