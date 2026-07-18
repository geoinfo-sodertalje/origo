# Origo internal interfaces — target architecture

Status: agreed design, pre-implementation. Implementations start as adapters
over the existing vanilla JS code; the interfaces are the stable boundary.

## Principles
- Interfaces first, implementations incrementally. Existing code keeps
  working; new code targets these contracts.
- DOM CustomEvents at component boundaries; TypedEmitter for internal APIs.
- Typed escape hatches (`getOlLayer()`) so no caller is ever blocked.
- Plugins receive a capability-scoped API object — never the viewer
  internals.

## TypedEmitter

A typed wrapper around the platform's native `EventTarget`/`CustomEvent` —
no library dependency, and no separate Map-based pub/sub of its own. This
makes it the *same* idiom as the DOM CustomEvents used at Lit component
boundaries (see Lit conventions below), just usable on plain classes too
(`EventTarget` doesn't require a DOM element). `on()` returns an
unsubscribe function to prevent listener leaks.

```typescript
export class TypedEmitter<TMap extends Record<string, unknown>> extends EventTarget {
  on<K extends keyof TMap & string>(
    ev: K, fn: (e: CustomEvent<TMap[K]>) => void
  ): () => void {
    const listener = fn as EventListener;
    this.addEventListener(ev, listener);
    return () => this.removeEventListener(ev, listener);
  }

  emit<K extends keyof TMap & string>(ev: K, payload: TMap[K]): void {
    this.dispatchEvent(new CustomEvent(ev, { detail: payload }));
  }
}
```

Relationship to existing event systems: this does **not** replace
`src/ui/utils/eventer.js` (`on`/`un`/`dispatch`, no unsubscribe return),
which every current UI component already uses via `src/ui/component.js`
(`Object.assign({}, Eventer(), Base(), options)` — factory + `Object.create`
composition, not classes; sometimes called the "ceeu" pattern). Existing
components keep using `Eventer` unmodified — nothing here requires
converting them to classes. Adapters that sit between the two (e.g. the
Legend adapter wrapping `src/controls/legend.js`) listen on the old
`Eventer`-based dispatch and re-`emit` through `TypedEmitter`/`CustomEvent`
on the new interface.

## Layer hierarchy

Abstract base class wrapping OL layers. Subclasses per type:
`WmsLayer extends Layer<TileLayer<TileWMS> | ImageLayer<ImageWMS>>` (Tile-
or Image-backed depending on `renderMode`; adds `getLegendGraphicUrl()`,
implements `QueryableService`), `WfsLayer`, `VectorLayer`, `WmtsLayer`
(implements `QueryableService`), `RasterLayer`, `AgsTileLayer` (implements
`QueryableService`), `GroupLayer` (holds `children: Layer[]`).

```typescript
export interface LayerOptions {
  name: string;
  title: string;
  group?: string;
  visible?: boolean;
  queryable?: boolean;
  minScale?: number;
  maxScale?: number;
  attribution?: string;
  backendType?: BackendType; // see "Backend dialect" below - unconsumed today
}

export type LayerEventMap = {
  'change:visible': { visible: boolean };
  'change:opacity': { opacity: number };
  'sourceerror': { error: Error };
};

export abstract class Layer<TOl extends OlBaseLayer = OlBaseLayer> {
  readonly name: string;
  readonly title: string;
  protected olLayer: TOl;
  private emitter = new TypedEmitter<LayerEventMap>();

  abstract get type(): 'wms' | 'wfs' | 'vector' | 'wmts' | 'group' | 'raster';

  get visible(): boolean { return this.olLayer.getVisible(); }
  setVisible(v: boolean): void {
    this.olLayer.setVisible(v);
    this.emitter.emit('change:visible', { visible: v });
  }

  /** Escape hatch — typed access to the underlying OL layer */
  getOlLayer(): TOl { return this.olLayer; }

  on<K extends keyof LayerEventMap>(
    ev: K, fn: (e: LayerEventMap[K]) => void
  ): () => void {
    return this.emitter.on(ev, fn);
  }
}
```

### Factory adapter

`wrapLayer(olLayer)` (`src/api/layer/factory.ts`) creates `Layer` wrappers
from the existing layer factory's output (`src/layer.js` +
`src/layer/*.js`, 16 registered origo layer types). Existing code that
manipulates OL layers directly keeps working; new code goes through the
wrapper. Not wired into `viewer.js`'s `addLayer` yet — that's Phase 5.

Dispatch key is `olLayer.get('type')` (Origo's own metadata string, e.g.
`'WMS'`, `'GEOJSON'` — already used the same way in `viewer.js`, e.g.
`layer.get('type') === 'GROUP'`), **not** `instanceof` on the OL class: the
same origo type can produce different OL classes depending on `renderMode`
(`WMS` and `AGS_MAP` can each be Tile- or Image-backed). Unrecognized or
missing `type` logs a warning and returns `undefined` rather than throwing.

| Origo `type` | Bucket | Concrete class | Notes |
|---|---|---|---|
| `WMS` | `wms` | `WmsLayer` | Tile- or Image-backed depending on renderMode |
| `WFS` | `wfs` | `WfsLayer` | vector-backed under the hood, kept distinct |
| `WMTS` | `wmts` | `WmtsLayer` | |
| `GROUP` | `group` | `GroupLayer` | `ol/layer/Group` |
| `GEOJSON, KML, GPX, TOPOJSON, FEATURE, AGS_FEATURE, VECTORTILE` | `vector` | `VectorLayer` | all go through `src/layer/vector.js` |
| `XYZ, OSM, COG, AGS_MAP` | `raster` | `RasterLayer` | no query capability |
| `AGS_TILE` | `raster` | `AgsTileLayer` | the one raster-bucket type with `QueryableService` |

### `GroupLayer.children`

Recursive, kept live rather than wrapped once at construction (which would
go stale when sub-layers are added/removed later) or re-wrapped on every
read (which breaks wrapper identity for anything holding a listener on a
child). A private `Map<OlBaseLayer, Layer>` cache is built at construction
by wrapping every current child (recursing into nested `GroupLayer`s
naturally via `wrapLayer`), then kept in sync via listeners on
`olLayer.getLayers()`'s `'add'`/`'remove'` Collection events, plus a
`'change:layers'` listener that re-subscribes if the whole collection is
replaced via `setLayers()`. `GroupLayer.destroy()` unsubscribes these
listeners, recursively for nested groups — the only class this phase that
holds live subscriptions; a `destroy()` on the `Layer` base class itself is
likely needed once more subclasses hold state like this, not yet done.

## QueryableService

A second, orthogonal interface axis alongside the type-bucket hierarchy
above — capability, not type. Covers the server-round-trip
GetFeatureInfo/Identify request, which in the real app
(`src/getfeatureinfo.js`'s `getGetFeatureInfoRequest`) is supported by
exactly three raw types — `WMS`, `WMTS`, `AGS_TILE` — cutting across the
`wms`/`wmts`/`raster` buckets; every other raster type (`XYZ, OSM, COG,
AGS_MAP`) falls to `default: return null`. Vector-backed types get feature
info through a completely different, already-covered path (`queryable`
flag + `map.forEachFeatureAtPixel`, no server call), so they don't
implement this interface.

```typescript
export interface QueryableService {
  getFeatureInfoUrl(coordinate: Coordinate, resolution: number, projection: string): Promise<unknown[]> | undefined;
}
```

Implemented by `WmsLayer`, `WmtsLayer`, `AgsTileLayer`. Stubbed (returns
`undefined`) in all three until `Layer` gains a viewer/context reference —
the real implementations need `resolution`, `projection`, and the full
viewer (`getMapSource()` lookups, GeoServer text/html branching, or the
ArcGIS identify URL), none of which the current `Layer` constructor
(`options, olLayer`) has. Natural home for that context is Phase 5's scoped
`MapApi`/`LayerApi`.

## Backend dialect

Origo's WMS/WFS/WMTS layers talk to different server implementations
(GeoServer, QGIS Server, MapServer, ArcGIS) that diverge from bare OGC spec
in vendor-specific ways. This already exists, partially and inconsistently,
as an untyped string — `mapSource[sourceName].type` (`'Geoserver'`,
`'QGIS'`, `'ArcGIS'`) — read ad hoc in `src/getfeatureinfo.js` (GeoServer-
only text/html GetFeatureInfo branch) and
`src/controls/print/print-resize.js` (resize-rule branching, with a
URL-substring fallback when the config field is absent). No MapServer
handling exists anywhere yet.

```typescript
export type BackendType = 'geoserver' | 'qgis' | 'mapserver' | 'arcgis' | 'ogc';
```

`'ogc'` is an explicit declaration of pure-spec/no-vendor-quirks behavior,
distinct from leaving `backendType` unset (unknown — today's ad hoc
fallback behavior is unaffected by this type existing). Added to
`LayerOptions` as `backendType?: BackendType`; not yet consumed anywhere —
`wrapLayer` doesn't set it, since raw OL layers don't carry `mapSource`
info directly. Distinct from the existing, already-working
`WfsSource.filterType` (`'cql'|'qgis'`, in `src/layer/wfssource.js`) — that
remains the WFS query-filter dialect specifically; `backendType` is the
broader concept covering GetFeatureInfo formatting and other cross-cutting
vendor behavior, relevant once `QueryableService.getFeatureInfoUrl` gets
its real implementation.

## Backlog: clustering as a capability

`styleByAttribute` and cluster options (`src/layer/vector.js`, gated to
`WFS`/`AGS_FEATURE` sources) are another legitimate cross-cutting
capability, structurally similar to `QueryableService`. Not scoped into
Phase 3 — noted here for a later phase.

## Legend

State + events. DOM rendering is a consumer of this interface, not the
interface itself (so rendering can later move to Lit without touching the
contract). Events fire regardless of cause (user click or programmatic
call); if cause matters, add `origin: 'user' | 'api'` to payloads rather
than separate event names.

```typescript
export interface LegendGroup {
  readonly name: string;
  readonly title: string;
  readonly expanded: boolean;
  readonly layers: readonly Layer[];
  readonly groups: readonly LegendGroup[]; // nested groups
}

export type LegendEventMap = {
  'group:expand': { group: LegendGroup };
  'group:collapse': { group: LegendGroup };
  'layer:toggle': { layer: Layer; visible: boolean };
  'render': {};
};

export interface Legend {
  getGroups(): readonly LegendGroup[];
  getGroup(name: string): LegendGroup | undefined;
  expandGroup(name: string): void;
  collapseGroup(name: string): void;
  expandAll(): void;
  collapseAll(): void;
  on<K extends keyof LegendEventMap>(
    ev: K, fn: (e: LegendEventMap[K]) => void
  ): () => void;
}
```

Implementation: `LegendAdapter` (`src/api/legend/adapter.ts`), constructed
via `wrapLegend(legendControl, viewer)` (`src/api/legend/factory.ts`) —
unlike `wrapLayer(olLayer)`, this needs *two* arguments, since neither
`legend.js`'s nor `Overlays`' returned Component exposes a `getViewer()`.
Wraps the real legend control (`src/controls/legend.js` — no public groups
API today, ~800 lines plus `src/controls/legend/*` sub-components) with no
changes to those files.

**Reachable surface**, all read via existing return objects, none of them
by name a "groups API":
```
legendControl.getOverlays().getGroups()   // flat array of every Group, any depth
group.getOverlayList().getOverlays()      // direct child Overlay[] (pre-nested)
group.getOverlayList().getGroups()        // direct child Group[] (pre-nested)
overlay.getLayer()                        // raw OL layer -> feed into wrapLayer()
```
Root groups = `groups.filter(g => g.type === 'group' || !g.parent)` (mirrors
`overlays.js`'s own root-vs-nested split). Hand-rolled structural types for
this untyped surface live in `src/api/legend/raw.ts` (no `.d.ts` exists for
`src/controls/legend*`).

**Expand/collapse has no getter anywhere** — `Collapse`
(`src/ui/collapse.js`) keeps `expanded` as a closure variable. `Group.getEl()`
returns the `Collapse`'s own rendered div directly (`group.js`:
`groupEl = document.getElementById(collapse.getId())`), so state is read as
`group.getEl()?.classList.contains('expanded')`. Controlling it: `collapseGroup`
dispatches `CustomEvent('collapse:collapse')` on that element (`Collapse`'s
own `collapse()` no-ops safely if already collapsed); `expandGroup` has no
forced-expand equivalent to dispatch, so it reads state first and only
dispatches `CustomEvent('collapse:toggle')` if not already expanded. Neither
event can be delegated from an ancestor — `Collapse.toggle()` calls
`stopPropagation()` unless `bubble` is set, which `Group`'s `Collapse` never
sets — so `LegendAdapter` attaches one `MutationObserver` per group's
element (`attributeFilter: ['class']`) rather than DOM event listeners,
specifically because `group.js`'s `tick:all`/`untick:all` handlers
(`autoExpand`) call `collapse.expand()`/`collapse.collapse()` as **direct
function calls**, bypassing dispatched events entirely — event listeners
alone would silently miss those transitions. New groups added later
(`viewer.on('add:group' | 'remove:group', ...)`) get a `MutationObserver`
attached/detached the same way; safe by construction ordering, since
`Overlays.onInit` registers its own `add:group` listener before any adapter
can exist, so by the time the adapter's listener runs, the new `Group`'s
`getEl()` is already populated.

**`layer:toggle`** subscribes to each layer's native OL `change:visible`
property event directly, not `Layer`'s own emitter — the legend's checkbox
(`overlay.js`) calls `setVisible()` on the **raw** OL layer, never through a
`Layer` wrapper, so `Layer`'s own `change:visible` would never fire from
legend-UI interaction. *(General gap, not Legend-specific: `Layer` has no
way to observe externally-mutated OL layers — noted here, not fixed.)*

**`render`** bridges the old Eventer's `legendControl.on('render', ...)` to
the adapter's own `TypedEmitter`, the same idiom as `TypedEmitter`'s own
section above.

**`getGroups()`/`getGroup()` rebuild a fresh snapshot tree on every call**
rather than a `GroupLayer`-style live cache — cheap, and correct because
`LegendGroup` has no `.on()` of its own, so tree-object identity doesn't
matter the way it did for `GroupLayer.children`. One exception: a single
`Map<OlBaseLayer, Layer>` cache inside the adapter preserves `Layer` wrapper
identity across calls (and backs the `change:visible` listener wiring),
without needing `GroupLayer`'s heavier Collection-listener machinery.

Out of scope, not silently dropped: `VisibleOverlays` (the "show only
visible layers" flat view, `visibleOverlays.js`) has no counterpart in this
contract, so it isn't modeled; `src/ui/collapse.js` wasn't touched to add a
forced-expand event or a state getter — shared primitive used by many
controls beyond Legend.

## Plugin API

Implemented: `PluginRegistry` (`src/api/plugin/registry.ts`), wired into
`origo.js` (`origo.use(plugin)` on the returned Component). Today, real
plugins (separate repos, see PLUGINS.md) ship as a global `<script>`
exposing a factory function, and the host page's own inline script wires
it up by hand — full raw `viewer` access, no capability scoping, no
teardown (confirmed by reading the reference example,
`github.com/origo-map/barebone-plugin`). This section formalizes that into
`origo.use(plugin)` with a real `init`/`destroy` lifecycle and a
capability-scoped `OrigoApi` — never the raw viewer.

**Registration/discovery is deliberately still explicit, not automatic** —
`use()` is host-page-driven, same ergonomics as today just typed. A
plugin-manifest/auto-discovery system remains future work, not attempted here.

**Key discovery that shaped the lifecycle design:** `origo.js`'s
`window.addEventListener('hashchange', ...)` can rebuild the viewer
entirely (a sharemap hash change re-runs `initViewer()`, constructing a new
`viewer` and re-dispatching `origo`'s own `'load'` event) — not previously
documented anywhere. `PluginRegistry.onViewerChange(viewer)` handles this:
on every viewer change (except the first, since there's nothing yet to
tear down), every registered plugin's `destroy()` (if present, each call
wrapped so one throwing plugin doesn't block the rest) runs against the
outgoing api, then `init(api)` runs again with a fresh `OrigoApi` for the
incoming viewer. A plugin registered via `use()` *after* `'load'` has
already fired once gets `init()` called immediately against the current
viewer, rather than left stranded until a reboot that may never come.
Cleanup note: a hash-change reboot replaces the whole viewer DOM subtree
wholesale (`viewer.js`'s `render()` does `el.innerHTML = htmlString`), so
plugin-inserted elements vanish with it automatically — `destroy()` only
needs to worry about listeners/timers registered outside that subtree.

Plugins receive a capability-scoped context object, not the viewer.

```typescript
export interface OrigoApi {
  readonly version: string;   // '1.0.0' - semver of the plugin API surface
  readonly map: MapApi;       // getView/getProjection/addInteraction/
                              // removeInteraction/on(click|movestart|
                              // moveend|pointermove)/getOlMap() escape hatch
  readonly layers: LayerApi;  // getLayer(name)/getLayers()/addLayer(def)
                              // -> Phase 3 Layer wrappers via wrapLayer(),
                              // on('addlayer'|'removelayer')
  readonly legend: Legend;
  readonly ui: UiApi;         // registerControl(slot, element: HTMLElement)
  readonly config: Readonly<ViewerConfig>;
}

export interface OrigoPlugin {
  readonly name: string;
  /** Called once per viewer, including after a hash-change rebuild. May be async. */
  init(api: OrigoApi): void | Promise<void>;
  /** Teardown - must remove listeners/timers outside the viewer's own DOM subtree. */
  destroy?(): void;
}

// registration:
origo.use(myPlugin);
```

Design decisions:
- `init` receives everything as an argument — no globals, no
  `viewer.getMap()...` chains. Plugins are testable against a real
  `createOrigoApi(viewer)` built from a test viewer (see Testing below), not
  a hand-mocked fake.
- Async `init` supported (plugins fetching config/capabilities need no
  ready-state hacks).
- `ui.registerControl` takes a plain `HTMLElement`, so plugins may be
  built with Lit (or anything) while the API stays framework-agnostic.
- API surface versioned from day one.

### `MapApi`/`LayerApi` — thin wrappers, not new class hierarchies
Both are plain object literals closing over the real `viewer`/`ol/Map`, not
classes — a plugin needs only a narrow, capability-scoped slice of what
already exists. `LayerApi` ties directly into Phase 3: every layer it
returns is a real `Layer` wrapper via `wrapLayer()`, never a raw OL layer.
`LayerApi.on('addlayer' | 'removelayer', ...)` bridges the viewer's real
`this.dispatch('addlayer', {...})`/`this.dispatch('removelayer', {...})`
(`src/viewer.js:455`, `:462`). `MapApi.on(...)` bridges OL's native
`map.on/un` (which pass raw OL events) into `CustomEvent`-wrapped,
unsubscribe-returning listeners, same shape as everywhere else in this API.

### `UiApi.registerControl` — real existing slots, not an invented layout system
Asked the user how `slot` should work, since no general layout/positioning
system exists in Origo; they pointed at Origo's own templating.
`src/components/main.js`'s `Main` component exposes four named,
already-real containers via getters — `getNavigation()`, `getMapTools()`,
`getMiscTools()`, `getBottomTools()` — and **every built-in control already
targets one of these** by DOM id (e.g. `src/controls/zoom.js`:
`document.getElementById(viewer.getMain().getNavigation().getId())
.appendChild(el)`; `rotate.js` → misc tools; `editor.js`/`measure.js`/
`draw.js`/`print`/`bookmarks`/externalurl controls → map tools;
`scaleline.js` → bottom tools). `UiSlot = 'navigation' | 'maptools' |
'misctools' | 'bottomtools' | 'sidebar'` routes into these same containers
via a raw DOM `appendChild` — no Component-tree wrapping needed, matching
exactly what every built-in control already does.

`'sidebar'` delegates to `src/sidebar.js`'s **singleton** panel ("There can
be only one sidebar in an entire page", per its own comment — shared,
last-write-wins if more than one thing targets it) via `setContent()`.
Two caveats specific to `'sidebar'`, not shared by the other four slots:
(1) `insertContent()` does `el.innerHTML = content` (a string), not
`appendChild(element)` — so only markup transfers, not the live DOM node;
event listeners already attached via `addEventListener` do **not**
survive, unlike the other four slots which insert the live element
directly. (2) `#o-sidebar`'s DOM only exists if something already called
`sidebar.init(viewer)` — normally done by `featureinfo.js` only when
configured with `infowindow: 'sidebar'`. `createUiApi` initializes it
lazily (checks for `#o-sidebar`, calls `sidebar.init(viewer)` if absent) so
`registerControl('sidebar', ...)` works regardless of that configuration.

A user-mentioned **per-layer toolbar** (closer to `editor.js`'s per-layer
edit toolbar than to this viewer-level slot system) is explicitly out of
scope for `registerControl` — a distinct, likely future capability, noted
as backlog, not force-fit into the slot enum.

### `ViewerConfig` — a real interface, not a loose placeholder
`src/viewer.js:32-61` already destructures a full, stable set of top-level
option keys with their own defaults — `ViewerConfig` types exactly those
(`breakPoints`, `projectionCode`, `extent`, `center`, `zoom`, `resolutions`,
`groups`, `layers`, `source`, `styles`, `featureinfoOptions`, etc.), all
optional. Nested shapes (`controls`/`layers` defs, each control's own
options, `source`/`styles` internals) stay loosely typed
(`unknown[]`/`Record<string, unknown>`) — fully typing those is each its
own, much bigger undertaking (every control has a different options shape;
every layer type has different fields). `viewer.getViewerOptions()`
(`src/viewer.js:169`) backs `OrigoApi.config` directly.

### `Layer.getConfig()` — every layer exposes its config settings (Phase 3 amendment)
Added to the base `Layer` class (`src/api/layer/layer.ts`) at the user's
request: `getConfig(): Readonly<Record<string, unknown>>` returns
`this.olLayer.getProperties()`. No new storage needed — the real layer
factory (`src/layer.js` + `src/layer/*.js`) already passes its entire
resolved options object into each OL layer's constructor (e.g. `wms.js`'s
`tile(wmsOptions, source)` → `new TileLayer(wmsOptions)`), and OL's
`BaseObject` retains every constructor key as a gettable property — the
same mechanism `type`/`group`/`queryable` already rely on. Best-effort, not
a guaranteed exact round-trip: OL consumes/transforms some keys during
construction (`style` becomes a real OL style function, `source` becomes
an actual `ol/source` instance) — fine for introspection, not a substitute
for the original config literal.

## Lit conventions
- Events out of components: `new CustomEvent(name, { detail, bubbles: true,
  composed: true })` — `composed` is required to cross shadow DOM.
- Type custom events via declaration merging on `HTMLElementEventMap` so
  vanilla `addEventListener` callers get typed `detail`.
- Where global CSS from the existing app must apply, override
  `createRenderRoot()` to return `this` (light DOM) per component.
