// Assembles build/ or build-dev/, replacing tasks/webpack.copy.js and
// tasks/webpack.copy-dev.js (CopyWebpackPlugin). Usage:
//   node scripts/copy-build-assets.mjs <build|build-dev>
import { execFileSync } from 'node:child_process';
import {
  cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url)).replace(/\/scripts$/, '');
const target = process.argv[2];

if (target !== 'build' && target !== 'build-dev') {
  console.error('Usage: node scripts/copy-build-assets.mjs <build|build-dev>');
  process.exit(1);
}

const targetDir = join(root, target);
const jsDir = join(targetDir, 'js');
mkdirSync(jsDir, { recursive: true });

// Built output goes to <target>/js/, matching the pre-Vite build shape (and
// what external deploy configs still expect). Root index.html/examples/*.html
// import from the flat repo-root origo.js, since that's where Vite's dev
// server actually serves the source - the copies placed in <target>/ have
// their import path rewritten below to match the js/ subfolder instead.

// Minified pass -> dist/origo.min.js (also the file consumers reuse from
// dist/ directly, so this always regenerates it before copying)
execFileSync('npx', ['vite', 'build'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, VITE_MINIFY: 'true' }
});
cpSync(join(root, 'dist/origo.min.js'), join(jsDir, 'origo.min.js'));

// Unminified pass -> scratch dir, copied in as js/origo.js
execFileSync('npx', ['vite', 'build'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, VITE_MINIFY: 'false' }
});
cpSync(join(root, '.vite-tmp/unmin/origo.js'), join(jsDir, 'origo.js'));
rmSync(join(root, '.vite-tmp'), { recursive: true, force: true });

// Static assets copied verbatim, same set as CopyWebpackPlugin's patterns
// in tasks/webpack.copy.js / webpack.copy-dev.js
const staticEntries = ['css', 'data', 'index.json', 'img'];
staticEntries.forEach((entry) => {
  cpSync(join(root, entry), join(targetDir, entry), { recursive: true });
});

// index.html and examples/*.html get copied with their origo.js import
// path rewritten to the js/ subfolder used in the built output.
function copyWithRewrittenImport(relPath) {
  const src = join(root, relPath);
  const dest = join(targetDir, relPath);
  mkdirSync(dirname(dest), { recursive: true });
  const html = readFileSync(src, 'utf8')
    .replace(/from '(\.{1,2}\/)origo\.js'/, "from '$1js/origo.js'");
  writeFileSync(dest, html);
}

copyWithRewrittenImport('index.html');
mkdirSync(join(targetDir, 'examples'), { recursive: true });
readdirSync(join(root, 'examples')).forEach((file) => {
  if (file.endsWith('.html')) {
    copyWithRewrittenImport(join('examples', file));
  } else {
    cpSync(join(root, 'examples', file), join(targetDir, 'examples', file));
  }
});

console.log(`Assembled ${target}/`);
