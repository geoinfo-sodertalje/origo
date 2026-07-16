# Origo TypeScript refactor (branch: origo-vibe)

## Goal
Incremental TypeScript migration of Origo (vanilla JS web map client built on
OpenLayers). Vite build. New typed internal interfaces (Layer base class,
Legend, Plugin API, Controls, Mapcanvas, toolbars, menu, infoclick popup, footer/toolbar) implemented as **adapters over existing code** — never
big-bang rewrites. At every intermediate step the app must remain shippable. End goal is to refactor the whole app to the new architecture.

**Adapters are a first step per subsystem, not the permanent design**
(clarified 2026-07-17). The wrapper classes (`wrapLayer`, and Legend's
planned equivalent) exist to prove each interface contract against real
behavior cheaply and keep the app shippable during the transition — the
intent is that each subsystem eventually gets a real rewrite (port the
actual logic from e.g. `src/layer/*.js` into the `.ts` file, delete the old
file, let the adapter indirection collapse), not that the old `.js` stays
forever behind a permanent typed facade. That rewrite should come only
after the subsystem has test coverage (see Testing below) — this repo had
zero tests for its entire history until the test-infrastructure work noted
in the phase list, and a rewrite without a safety net is exactly how the
Phase 1 COG chunk-splitting bug shipped unnoticed. The adapter-vs-rewrite
call is made per-subsystem, informed by how the tests go — not decided
up front for the whole app.

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

## Testing
**Vitest + jsdom**, added after Phase 3 (repo had zero tests before this).
`npm run test` (one-shot) / `npm run test:watch`. Config in `vitest.config.ts`
(deliberately separate from `vite.config.ts` — that file's build-output
concerns, e.g. `inlineDynamicImports`, have no bearing on running tests).

**jsdom is required, not optional**, for any test that constructs a real
`Viewer` (which most meaningful tests here do, transitively — `src/layer/*.js`
builders all take a real viewer) — `src/viewer.js` does
`document.querySelector(target)` and expects a real DOM element. Shared
fixture: `src/test-utils/create-test-viewer.ts`, boots a real `Viewer`
(not `origo.js`'s full `Origo()` — controls aren't needed for layer
construction) against a minimal-but-real config.

**jsdom gotchas hit and fixed in `src/test-utils/vitest.setup.ts`** (worth
knowing before writing more tests, e.g. for Legend, which will exercise the
DOM/rendering path much harder):
- No `ResizeObserver` — OL's `Map` uses one to detect target size changes.
  Stubbed with a class whose `observe()` synchronously invokes the callback
  once (OL's own usage ignores the callback's arguments entirely, just
  calls `updateSize()` on any resize, so this is enough).
- `getComputedStyle(el).borderLeftWidth` returns the unresolved keyword
  `'medium'` for any element with no explicit border style (real browsers
  resolve this to `'0px'` when there's no border). OL's
  `Map.updateSize()` does `parseFloat(computedStyle.borderLeftWidth)`
  unconditionally, and `parseFloat('medium')` is `NaN`, poisoning the
  whole size calculation into permanently `undefined` — silently breaks
  anything downstream that calls `map.getSize()` (e.g. `src/utils/mapsize.js`
  throwing on `size[0]`). Fixed with a global `* { border-width: 0; padding:
  0; }` stylesheet injected in the setup file, since the actual target
  element is created dynamically by `Viewer`'s own `render()` — there's no
  fixed element to style ahead of time.
- `jsdom` offsets (`offsetWidth`/`offsetHeight`) are always `0` regardless
  of any styling — jsdom does no real layout. This is fine for the current
  test scope (map "works" at a `[0, 0]` reported size for construction-only
  characterization tests) but will matter if a future test needs a
  non-trivial map viewport size (e.g. testing render-triggered tile loading).
- Constructing a `Viewer` directly (bypassing `origo.js`) needs a
  `localization` control passed in explicitly — `Stylewindow` unconditionally
  calls `.getStringByKeys` on whatever `controls.find(c => c.name ===
  'localization')` returns, and `origo.js` normally guarantees one exists.
  Also needs `.options` set manually on that control instance (`viewer.js`'s
  `addControl` reads `control.options.hideWhenEmbedded` — `origin.js` sets
  `.options` on every control after creating it, a step skipped when
  bypassing it).

**Coverage so far:** `src/layer/layer.test.ts` — one characterization test
per Phase 3 bucket (`WMS` tile + image renderMode, `WFS`, `GEOJSON` as the
vector-bucket representative, `OSM` as the raster-bucket representative,
`AGS_TILE`, and `GROUP` with a nested layer, including a live-sync check
after adding a sub-layer post-construction), each paired with a `wrapLayer()`
assertion tying the characterization directly to Phase 3's adapter. Legend
characterization tests are **not** written yet — deferred to whenever
Legend work resumes, since they need the fuller `Origo()` control-wiring
path (not just a bare `Viewer`) plus real DOM rendering of `Collapse`/`Group`.

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

   **Relocated in Phase 3:** `src/api/layer.ts` (the base `Layer` class)
   moved to `src/api/layer/layer.ts` as part of grouping all layer-related
   files together — see Phase 3's own retro below.
3. **Done.** Layer adapter wrapping the existing layer factory output, in
   its own subfolder: `src/api/layer/{layer,wms,wfs,wmts,vector,raster,
   ags-tile,group,factory}.ts` (base `Layer` class, concrete subclasses,
   and `factory.ts`'s `wrapLayer`). The two cross-cutting interfaces
   (`QueryableService`, `BackendType`) live in `src/api/interfaces/`,
   separate from the layer-domain folder, since they aren't owned by any
   one class. `legend.ts`/`plugin.ts`/`typed-emitter.ts` stay flat at
   `src/api/` top level for now — not enough sibling files yet to earn
   their own folders; expect that to change once Phases 4-5 add Legend/
   Plugin adapters.

   `wrapLayer` dispatches on `olLayer.get('type')`, not `instanceof` — the
   same origo type can produce different OL classes depending on
   `renderMode` (e.g. WMS/AGS_MAP). Same posture as Phase 2: new code only,
   not wired into `viewer.js`'s `addLayer` (Phase 5 territory).

   **Deviations from architecture.md's original sketch, all resolved with
   user sign-off and now reflected in the doc:** (1) the `Layer.type` union
   only covered 5 of the real factory's 16 registered layer types — added a
   6th bucket, `raster` (`XYZ, OSM, AGS_TILE, COG, AGS_MAP`); (2)
   `getFeatureInfoUrl` was written as WMS-only in the doc's prose, but the
   real capability (`src/getfeatureinfo.js:getGetFeatureInfoRequest`) is
   shared by `WMS`, `WMTS`, and `AGS_TILE` only — pulled out into a second,
   orthogonal `QueryableService` interface implemented by those three
   (`AgsTileLayer` gets its own class rather than folding into `RasterLayer`
   for exactly this reason); all three implementations are stubs returning
   `undefined` until `Layer` has a viewer/context reference (needs
   `resolution`/`projection`/the viewer — Phase 5 territory); (3) added a
   typed `backendType?: BackendType` field to `LayerOptions`
   (`'geoserver'|'qgis'|'mapserver'|'arcgis'|'ogc'`) reflecting the
   real-but-untyped OGC server dialect already read ad hoc from
   `mapSource[...].type` in `getfeatureinfo.js`/`print-resize.js` — not
   consumed by anything yet, ready for when `getFeatureInfoUrl` gets its
   real implementation.

   **`GroupLayer.children`:** recursive, kept live via listeners on the OL
   Collection's `add`/`remove` events plus a `change:layers` resubscribe
   (not eager-once, which goes stale, nor lazy-per-read, which breaks
   wrapper identity). `GroupLayer.destroy()` unsubscribes, recursively for
   nested groups — flagged that the `Layer` base class will likely need its
   own `destroy()` once more subclasses hold live state like this; not done
   yet.

   **Confirmed out of scope, not silently dropped:** clustering
   (`styleByAttribute`, cluster options — `WFS`/`AGS_FEATURE` only) as a
   capability interface, structurally similar to `QueryableService` — noted
   as backlog in architecture.md. No test framework existed anywhere in the
   repo at the time (confirmed: no jest/vitest/mocha, no config, no
   `*.test.ts`); not introduced for this phase, same as Phase 2 — added
   afterward, see Testing above and the entry below.
3.5. **Done.** Test infrastructure (Vitest + jsdom) plus a first batch of
   characterization tests against the Layer subsystem (Phase 3's adapter
   target) — see Testing above for the full writeup and jsdom gotchas.
   Not a numbered migration phase in the original sense (no new interface
   contract), but load-bearing: added specifically to de-risk the
   adapter-vs-rewrite decision before continuing to Phase 4, per the Goal
   section's clarification above. Layer chosen over Legend as the first
   subsystem to characterize since it needs no DOM-component rendering.
4. **Done.** Legend adapter wrapping the existing legend component
   (`src/controls/legend.js`, 800+ lines, plus `src/controls/legend/*`
   sub-components), in its own subfolder: `src/api/legend/{legend,raw,
   adapter,factory}.ts` (relocated from bare `src/api/legend.ts`, same
   `src/api/layer/`-style grouping as Phase 3). Was on hold pending the
   Layer adapter-vs-rewrite decision; user chose to resume this phase
   directly instead of blocking on that decision, which is still open,
   tracked separately. Full design and the "no public groups API today"
   findings are written up in `docs/architecture.md`'s Legend section — the
   short version: everything needed (group tree, layer refs, expand/collapse
   state) is reachable through existing return objects with zero changes to
   `src/controls/legend*`, but expand/collapse state has no getter anywhere
   (DOM class read only) and needed a `MutationObserver` per group rather
   than DOM event listeners, since `tick:all`/`untick:all` bypass dispatched
   events entirely (direct `collapse.expand()`/`collapse.collapse()` calls).
   `wrapLegend(legendControl, viewer)` needs both arguments, unlike
   `wrapLayer(olLayer)`'s single one — no `getViewer()` anywhere to reach it
   through the wrapped object itself. Same posture as Phases 2-3: new code
   only, not wired into anything; no Legend-specific tests yet (see the
   Backlog note on expanding test coverage) — deferred since it needs the
   fuller `Origo()` control-wiring path plus real DOM rendering, unlike the
   bare-`Viewer` tests Layer got away with.
5. Plugin API v1 as a facade. Note: there is no existing plugin
   registration mechanism to adapt — no `origo.use()`, no plugin loader, no
   `plugins/` directory in this repo. Today "plugins" are separate repos a
   host page imports and wires up by hand (see PLUGINS.md). So this phase
   is net-new surface, not an adapter over existing code — treat the "never
   big-bang" rule as applying to the rest of the app, not this phase. Port
   ONE real plugin as proof once the facade exists.

## Backlog (not yet scheduled)
- **Expand test coverage.** `src/layer/layer.test.ts` (added alongside
  Vitest setup, see Testing above) only covers one construction-time
  characterization test per Phase 3 bucket plus a `wrapLayer()` assertion —
  it does not yet cover: option variations within a bucket (e.g. WMS
  `stylePicker`/GeoServer text-html GetFeatureInfo path, WFS `filterType`
  `cql` vs `qgis`, vector clustering), post-construction behavior beyond the
  one live-sync group check (visibility toggling, opacity, `destroy()`
  cleanup), or anything Legend-side (deferred until that adapter exists and
  needs the fuller `Origo()`/DOM-rendering path anyway). Revisit and grow
  this once there's a concrete reason to touch a given area again, rather
  than backfilling exhaustively up front.
- `src/api/` naming/location: user flagged `api/` as too generic a name for
  what's really "the new TypeScript code area." Plan (their call, not yet
  scheduled): rename `src/api/` to `src/ts/`, then later — once the
  migration is far enough along that this isn't a special "new" area
  anymore — drop that wrapper folder entirely and move its subfolders
  (`layer/`, `interfaces/`, etc.) straight up to live under `src/` directly,
  alongside the existing `.js` files. Do this as a deliberate rename/move
  pass of its own, not folded silently into a content phase.
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
