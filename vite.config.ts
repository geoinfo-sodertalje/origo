import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('./origo.js', import.meta.url));

// Two build passes share this config (see scripts/copy-build-assets.mjs):
// VITE_MINIFY=true -> dist/origo.min.js (matches today's dist/ output)
// VITE_MINIFY=false -> .vite-tmp/unmin/origo.js (scratch, copied into
// build/ or build-dev/ by the copy script as the unminified variant)
//
// Output format is ES module (real `export default Origo`), not the
// previous global-var IIFE - this is a deliberate, disclosed break from
// the old deploy contract (see CLAUDE.md) so index.html/examples/*.html
// can use `<script type="module">` identically in dev and in the built
// output. Anyone currently consuming origo.min.js as a classic script via
// a global `Origo` var will need to switch to `import Origo from
// './js/origo.min.js'`. Output path itself (build/js/) is unchanged -
// see scripts/copy-build-assets.mjs for how the flat repo-root import
// used in dev gets rewritten to js/ for the built copies.
export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {
      root: '.',
      server: {
        port: 9966
      }
    };
  }

  const minify = process.env.VITE_MINIFY !== 'false';

  return {
    build: {
      lib: {
        entry,
        formats: ['es'],
        fileName: () => (minify ? 'origo.min.js' : 'origo.js')
      },
      outDir: minify ? 'dist' : '.vite-tmp/unmin',
      // dist/ also holds sass output (style.css, style.css.map) - never wipe it
      emptyOutDir: false,
      minify: minify ? 'terser' : false,
      sourcemap: true
    }
  };
});
