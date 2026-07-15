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

First implementation: adapter wrapping the current legend component
(`src/controls/legend.js` — no public groups API today, ~800 lines plus
`src/controls/legend/*` sub-components), translating its `Eventer`-based
dispatches into `LegendEventMap` emissions (see TypedEmitter above for how
the two event systems relate).

## Plugin API

Note: there is no existing runtime plugin mechanism in this repo to adapt —
no `origo.use()`, no plugin loader, no `plugins/` directory. Today
"plugins" are separate repos a host page imports and wires up by hand,
often monkey-patching the viewer/app instance directly (see PLUGINS.md).
This section is net-new surface, not a wrapper over existing code.

Open design question, not yet resolved: `OrigoPlugin`/`origo.use()` below
give plugins a typed init contract once they're registered, but don't yet
say *how* a plugin gets discovered and loaded at runtime in a standard way
(vs. today's ad hoc host-page wiring/monkey-patching). Worth a follow-up
design pass — e.g. a plugin manifest file — before Phase 5 is planned in
detail.

Plugins receive a capability-scoped context object, not the viewer.

```typescript
export interface OrigoApi {
  readonly version: string;   // semver of the plugin API surface
  readonly map: MapApi;       // view, projection, addInteraction,
                              // on('click' | 'movestart' | ...)
  readonly layers: LayerApi;  // getLayer(name), getLayers(),
                              // addLayer(def), events
  readonly legend: Legend;
  readonly ui: UiApi;         // registerControl(slot, element: HTMLElement),
                              // panels, notifications
  readonly config: Readonly<ViewerConfig>;
}

export interface OrigoPlugin {
  readonly name: string;
  /** Called once when the viewer is ready. May be async. */
  init(api: OrigoApi): void | Promise<void>;
  /** Teardown — must remove listeners, DOM, interactions. */
  destroy?(): void;
}

// registration:
origo.use(myPlugin);
```

Design decisions:
- `init` receives everything as an argument — no globals, no
  `viewer.getMap()...` chains. Plugins are testable against a mocked
  `OrigoApi`.
- Async `init` supported (plugins fetching config/capabilities need no
  ready-state hacks).
- `ui.registerControl` takes a plain `HTMLElement`, so plugins may be
  built with Lit (or anything) while the API stays framework-agnostic.
- API surface versioned from day one.

## Lit conventions
- Events out of components: `new CustomEvent(name, { detail, bubbles: true,
  composed: true })` — `composed` is required to cross shadow DOM.
- Type custom events via declaration merging on `HTMLElementEventMap` so
  vanilla `addEventListener` callers get typed `detail`.
- Where global CSS from the existing app must apply, override
  `createRenderRoot()` to return `this` (light DOM) per component.
