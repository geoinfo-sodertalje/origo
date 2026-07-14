// Assembles build/ or build-dev/, replacing tasks/webpack.copy.js and
// tasks/webpack.copy-dev.js (CopyWebpackPlugin). Usage:
//   node scripts/copy-build-assets.mjs <build|build-dev>
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url)).replace(/\/scripts$/, '');
const target = process.argv[2];

if (target !== 'build' && target !== 'build-dev') {
  console.error('Usage: node scripts/copy-build-assets.mjs <build|build-dev>');
  process.exit(1);
}

const targetDir = join(root, target);
mkdirSync(targetDir, { recursive: true });

// Output lands flat at <target>/origo.js + origo.min.js, matching where
// Vite serves the source origo.js in dev (repo root) - index.html and
// examples/*.html use the same relative import path either way.

// Minified pass -> dist/origo.min.js (also the file consumers reuse from
// dist/ directly, so this always regenerates it before copying)
execFileSync('npx', ['vite', 'build'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, VITE_MINIFY: 'true' }
});
cpSync(join(root, 'dist/origo.min.js'), join(targetDir, 'origo.min.js'));

// Unminified pass -> scratch dir, copied in as origo.js
execFileSync('npx', ['vite', 'build'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, VITE_MINIFY: 'false' }
});
cpSync(join(root, '.vite-tmp/unmin/origo.js'), join(targetDir, 'origo.js'));
rmSync(join(root, '.vite-tmp'), { recursive: true, force: true });

// Static assets copied verbatim, same set as CopyWebpackPlugin's patterns
// in tasks/webpack.copy.js / webpack.copy-dev.js
const staticEntries = ['css', 'examples', 'data', 'index.html', 'index.json', 'img'];
staticEntries.forEach((entry) => {
  cpSync(join(root, entry), join(targetDir, entry), { recursive: true });
});

console.log(`Assembled ${target}/`);
