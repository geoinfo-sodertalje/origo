import type { Legend } from '../legend/legend';
import type { Layer } from '../layer/layer';

/**
 * Today, real plugins (separate repos, see PLUGINS.md) ship as a global
 * <script> exposing a factory function, and the host page's own inline
 * script wires it up by hand - e.g. `origo.on('load', viewer =>
 * viewer.addComponent(SomePlugin({...})))` - full raw viewer access, no
 * capability scoping, no teardown (confirmed against the reference
 * example, github.com/origo-map/barebone-plugin). This module formalizes
 * that into a typed, capability-scoped contract: OrigoApi gives a plugin
 * only map/layers/legend/ui/config, not the raw viewer; PluginRegistry
 * (./registry.ts) implements origo.use(plugin) with a real init/destroy
 * lifecycle, including correctly handling that origo.js can rebuild the
 * viewer entirely (a sharemap hash change) - see registry.ts for why that
 * matters.
 */

/** Real OL map events a plugin might reasonably want, kept narrow on purpose. */
export type MapEventType = 'click' | 'movestart' | 'moveend' | 'pointermove';

export interface MapApi {
  getView(): import('ol/View').default;
  getProjection(): import('ol/proj/Projection').default | undefined;
  addInteraction(interaction: import('ol/interaction/Interaction').default): void;
  removeInteraction(interaction: import('ol/interaction/Interaction').default): void;
  /** Bridges OL's native map.on/un (raw OL events) into CustomEvent + unsubscribe. */
  on(event: MapEventType, fn: (e: CustomEvent) => void): () => void;
  /** Escape hatch, same precedent as Layer.getOlLayer(). */
  getOlMap(): import('ol/Map').default;
}

export type LayerApiEventType = 'addlayer' | 'removelayer';

export interface LayerApi {
  getLayer(name: string): Layer | undefined;
  getLayers(): Layer[];
  addLayer(def: Record<string, unknown>): Layer | undefined;
  /** Bridges the viewer's real dispatch('addlayer' | 'removelayer', {layerName}). */
  on(event: LayerApiEventType, fn: (e: CustomEvent<{ layerName: string }>) => void): () => void;
}

/**
 * Real, already-existing UI insertion points - src/components/main.js's
 * Main component exposes four named containers every built-in control
 * already targets (getNavigation/getMapTools/getMiscTools/getBottomTools),
 * plus src/sidebar.js's singleton panel (shared - last write wins, same
 * constraint the real sidebar already has for everyone). Not an invented
 * layout system - deliberately limited to what Origo already has.
 */
export type UiSlot = 'navigation' | 'maptools' | 'misctools' | 'bottomtools' | 'sidebar';

export interface UiApi {
  /**
   * Inserts a plain element into a real Origo UI slot. Framework-agnostic
   * on purpose - a plugin may be built with Lit or anything else. Cleanup:
   * a hash-change reboot replaces the whole viewer DOM subtree wholesale,
   * so plugin-inserted elements vanish with it automatically - a plugin's
   * destroy() only needs to worry about listeners/timers registered
   * outside that subtree (e.g. on window/document directly).
   */
  registerControl(slot: UiSlot, element: HTMLElement): void;
}

/**
 * Real, stable top-level viewer config keys (src/viewer.js:32-61 already
 * destructures exactly these, with these defaults). Not a complete typing
 * of the app - nested shapes (each control's own options, per-layer-type
 * fields, source/styles internals) stay loosely typed; those are each
 * their own, much bigger undertaking. viewer.getViewerOptions() backs
 * OrigoApi.config directly.
 */
export interface ViewerConfig {
  breakPoints?: Record<string, [number, number]>;
  breakPointsPrefix?: string;
  clsOptions?: string;
  consoleId?: string;
  mapCls?: string;
  controls?: unknown[];
  featureinfoOptions?: Record<string, unknown>;
  groups?: unknown[];
  pageSettings?: Record<string, unknown>;
  projectionCode?: string;
  projectionExtent?: [number, number, number, number];
  startExtent?: [number, number, number, number];
  extent?: [number, number, number, number];
  center?: [number, number];
  zoom?: number;
  resolutions?: number[];
  layers?: unknown[];
  layerParams?: Record<string, unknown>;
  map?: string;
  params?: Record<string, unknown>;
  proj4Defs?: Array<{ code: string; projection: string }>;
  styles?: Record<string, unknown>;
  source?: Record<string, unknown>;
  clusterOptions?: Record<string, unknown>;
  tileGridOptions?: Record<string, unknown>;
  loggerOptions?: Record<string, unknown>;
  url?: string;
  palette?: unknown;
  projection?: unknown;
}

export interface OrigoApi {
  readonly version: string; // semver of the plugin API surface
  readonly map: MapApi;
  readonly layers: LayerApi;
  readonly legend: Legend;
  readonly ui: UiApi;
  readonly config: Readonly<ViewerConfig>;
}

export interface OrigoPlugin {
  readonly name: string;
  /** Called once per viewer (including after a hash-change rebuild). May be async. */
  init(api: OrigoApi): void | Promise<void>;
  /** Teardown - must remove listeners/timers outside the viewer's own DOM subtree. */
  destroy?(): void;
}

// registration: origo.use(myPlugin) - see ./registry.ts
