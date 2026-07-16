import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts on purpose - that file's build.lib/rollupOptions
// (single-bundle output, inlineDynamicImports) are production build-output
// concerns with no bearing on running tests; mixing them in risks the exact
// kind of build-only surprise Phase 1 already hit once (see CLAUDE.md).
export default defineConfig({
  test: {
    // Every test in this repo's domain touches the DOM transitively through
    // Viewer (src/viewer.js does document.querySelector(target)), so this is
    // a blanket requirement, not a per-file override.
    environment: 'jsdom',
    setupFiles: ['src/test-utils/vitest.setup.ts'],
    include: ['src/**/*.test.ts']
  }
});
