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
- Do not change the build/deploy contract: `npm run build` must still
  produce `build/` with the same layout it has today — `js/origo.min.js`
  and `js/origo.js` (from `dist/origo.min.js`), `css/`, `examples/`,
  `data/`, `index.html`, `index.json`, `img/`, per
  `tasks/webpack.copy.js`. (There is no `origo-build.py` or other deploy
  script in this repo — that reference in an earlier version of this file
  didn't match anything on disk.)
- If execution diverges from the approved plan, stop and re-enter Plan Mode.

## Architecture
Interface contracts (Layer, Legend, Plugin API) are specified in
`docs/architecture.md`. Plans for interface work must conform to that
document; if reality forces a deviation, surface it — do not improvise.

## Migration phases (one plan/session each, merge after every phase)
1. Build tooling: Vite + tsconfig (`allowJs: true`), everything compiles,
   deploy artifact unchanged. Acceptance check: Vite output must match the
   current webpack contract exactly — single bundle, no code-splitting
   (`chunkLoading: false` today), global var named `Origo`
   (`library: { type: 'var', export: 'default', name: 'Origo' }` in
   `tasks/webpack.prod.js`/`webpack.copy.js`), all deps (`ol`, `proj4`, ...)
   bundled in, none externalized. Also decide explicitly whether the
   `core-js/stable` polyfill entry (`tasks/webpack.common.js`) is still
   needed for the supported browser targets, since Vite won't add it for
   free.
2. Interface files only: `layer.ts`, `legend.ts`, `plugin.ts`,
   `typed-emitter.ts`. Pure types + minimal runtime.
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
