# Origo TypeScript refactor (branch: origo-vibe)

## Goal
Incremental TypeScript migration of Origo (vanilla JS web map client built on
OpenLayers). Vite build. New typed internal interfaces (Layer base class,
Legend, Plugin API, Controls, Mapcanvas, toolbars, menu, infoclick popup, footer/toolbar) implemented as **adapters over existing code** — never
big-bang rewrites. At every intermediate step the app must remain shippable. End goal is to refactor the whole app to the new architecture.

## Hard rules
- `allowJs: true` in tsconfig. Never mass-convert .js files; convert only
  files we are actively touching in the current task.
- Existing public behavior must not change. Existing plugins and viewer
  configs must keep working unmodified.
- New or rewritten UI components use **Lit** (web components). Never
  introduce React, Vue, or any other framework.
- All new code accesses OL layers through the `Layer` wrapper class;
  `getOlLayer()` is the typed escape hatch for anything the wrapper does
  not cover.
- Events: DOM CustomEvents at component boundaries (bubbles + composed),
  the internal TypedEmitter for API-level events. Lit components dispatched
  events must set `composed: true`.
- `on()` on any internal emitter returns an unsubscribe function.
- Do not change the build/deploy contract beyond what's recorded below as
  a deliberate, disclosed deviation. **Update, Phase 1 retro:** the bundle
  *format* changed on purpose, with explicit user sign-off, mid-Phase-1 —
  `build/js/origo.js`/`origo.min.js` are now real ES modules
  (`export default Origo`), not the old global-var IIFE. The *path* is
  unchanged (`build/js/`, restored after an initial attempt flattened it
  to `build/` root — that broke a real external deploy config hardcoding
  `js/origo.min.js`, caught only after the fact; see `scripts/
  copy-build-assets.mjs`). Root `index.html`/`examples/*.html` (the dev
  entries) import the flat `./origo.js`/`../origo.js` from repo root,
  since that's where Vite's dev server actually serves the source; the
  copies placed in `build/`/`build-dev/` get their import rewritten to
  `./js/origo.js` at copy time to match the restored path. **The format
  change still breaks anyone currently consuming `origo.min.js` as a
  classic script with a global `Origo` var** — that includes whatever the
  committed `build/` in git history was already serving to real
  consumers; only the path regression got caught and fixed, the format
  break is still live and still needs that external config updated to
  `<script type="module">` + `import Origo from './js/origo.min.js'`.
  If dual-shipping (ESM + a separate global-var build) turns out to be
  needed, see `vite.config.ts` — Vite's lib mode supports multiple
  `formats` in one build, that path was deliberately not taken here.
- If execution diverges from the approved plan, stop and re-enter Plan Mode.

## Architecture
Interface contracts (Layer, Legend, Plugin API) are specified in
`docs/architecture.md`. Plans for interface work must conform to that
document; if reality forces a deviation, surface it — do not improvise.

## Migration phases (one plan/session each, merge after every phase)
1. **Done.** Build tooling: Vite + tsconfig (`allowJs: true`), everything
   compiles. All deps (`ol`, `proj4`, ...) bundled in, none externalized.
   `core-js/stable` was dropped (no declared browser-support floor
   existed anywhere in the project). One deviation from the original bar:
   output format changed from global-var IIFE to ES module — see the hard
   rule above for why and what it breaks. `tasks/webpack.*.js` and
   `jsconfig.json` removed; `vite.config.ts`/`tsconfig.json` are the new
   source of truth.

   **Caught in production, not in review:** the initial build silently
   violated "single bundle, no code-splitting" — `ol`'s GeoTIFF/COG codec
   support (recent "Add layer type COG" work) uses dynamic `import()`
   internally, and Vite's bundler (Rolldown, as of `vite@8`) split those
   into separate chunk files (`rolldown-runtime-*.mjs`, `pako.esm-*.mjs`,
   several codec `.mjs` files) instead of inlining them. `node --check`
   and basic load tests didn't catch this since the main file was still
   valid JS that loaded fine on its own — only a real deploy running
   without those extra chunk files present surfaced the 404. Fixed via
   `build.rollupOptions.output.inlineDynamicImports: true` in
   `vite.config.ts`. **Verification for this specific bug going forward:**
   `grep -o 'from"\.[^"]*"' dist/origo.min.js` (or the unminified
   equivalent with `from '...'`) must return nothing — any relative
   import means a chunk got split out again.
2. **Done.** Interface files only: `src/api/layer.ts`, `src/api/legend.ts`,
   `src/api/plugin.ts`, `src/api/typed-emitter.ts`. Pure types + minimal
   runtime, per `docs/architecture.md`. No adapters, nothing wired into
   `origo.js`'s bundle graph — these files aren't imported from anywhere
   yet, so the shipped app is unaffected this phase.

   **Location:** `src/api/`, not bare `src/*.ts` — a root-level `layer.ts`
   would have collided with the existing `src/layer.js` (the current layer
   factory, imported by `src/viewer.js`). `src/api/` keeps the new typed
   contracts isolated and matches architecture.md's own naming for the
   plugin-facing surface (`OrigoApi`, `LayerApi`, `UiApi`). Future adapters
   (Phases 3-5) should default to living here too unless a phase's plan
   says otherwise.

   **Fixed a type bug in architecture.md's own code sample:** the doc's
   `Layer.on()` forwarded its `fn` (typed to receive the raw event payload)
   straight into `TypedEmitter.on()` (which expects a callback receiving a
   `CustomEvent<T>`) — fails under `strict: true`. Implemented as intended
   (ergonomic public API: callers get the raw payload) by unwrapping
   `.detail` inside `Layer.on()` before calling `fn`.

   **Plugin API placeholders:** `MapApi`, `LayerApi`, `UiApi`, `ViewerConfig`
   are referenced in architecture.md's `OrigoApi` but never defined there —
   consistent with the doc's own note that the Plugin API's runtime
   discovery/loading mechanism is an open design question for Phase 5.
   `src/api/plugin.ts` stubs all four as minimal, explicitly-commented
   "provisional — full shape designed in Phase 5" placeholders so the file
   type-checks without pre-empting that design pass. `ViewerConfig` in
   particular has no existing typed shape to draw from — today's real
   config is an untyped plain object assembled ad hoc in `origo.js`'s
   `Origo()` factory.

   **Lint:** verified empirically that `npm run lint` (ESLint 8.57,
   `airbnb-base`, no `@typescript-eslint` installed) already silently
   ignores `.ts` files when scanning a directory — ESLint 8's default
   `--ext` is `.js` only, confirmed by testing both a `.ts`-only directory
   (errors "no files matching pattern", irrelevant since `src/` also has
   hundreds of `.js` files) and a mixed `.js`+`.ts` directory (clean exit,
   `.ts` silently skipped, no crash). No lint script/config changes needed;
   `.ts` correctness is `npx tsc --noEmit` only, same as Phase 1.
3. Layer adapter wrapping the existing layer factory output.
4. Legend adapter wrapping the existing legend component
   (`src/controls/legend.js`, 800+ lines, plus `src/controls/legend/*`
   sub-components). It has no public groups API today — the adapter has to
   reconstruct `LegendGroup` state from internal DOM/component state, not
   just wrap a method. Budget more than one session if it doesn't fit.
5. Plugin API v1 as a facade. Note: there is no existing plugin
   registration mechanism to adapt — no `origo.use()`, no plugin loader, no
   `plugins/` directory in this repo. Today "plugins" are separate repos a
   host page imports and wires up by hand (see PLUGINS.md). So this phase
   is net-new surface, not an adapter over existing code — treat the "never
   big-bang" rule as applying to the rest of the app, not this phase. Port
   ONE real plugin as proof once the facade exists.

## Backlog (not yet scheduled)
- Centralize backend requests through a single HTTP client
  (`src/utils/http.js`), so auth tokens/headers can be injected in one
  place instead of ~30 independent `fetch()`/`XMLHttpRequest` call sites.
  Not priority one — full design (interceptor hook, migration list, error
  behavior, out-of-scope items) is written up at
  `/home/dstenw1/.claude/plans/linked-petting-moon.md`, ready to pick up
  as its own phase when scheduled.

## Commands
- `npm run dev` — Vite dev server
- `npm run build` — production build
- `npx tsc --noEmit` — type check (run this + build before declaring done)

## Environment notes
- Host: geodatalab (Rocky Linux, sea7548sas59). Repo lives on local disk in
  the user's home directory — never work against CIFS/UNC mounts.
- The user's login shell is tcsh; any shell snippets shown to the user
  should be tcsh-compatible or explicitly marked as bash.
- Live QGIS Server/Apache runs on this host — do not touch /etc/httpd,
  /var/www, or anything outside the repo without explicit instruction.
