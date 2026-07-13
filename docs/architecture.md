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
`WmsLayer extends Layer<TileLayer<TileWMS>>` (adds `getLegendGraphicUrl()`,
`getFeatureInfoUrl(coordinate)`), `WfsLayer`, `VectorLayer`,
`GroupLayer` (holds `children: Layer[]`).

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

  abstract get type(): 'wms' | 'wfs' | 'vector' | 'wmts' | 'group';

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

Migration: a factory adapter creates `Layer` wrappers from the existing
layer factory output. Existing code that manipulates OL layers directly
keeps working; new code goes through the wrapper.

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
