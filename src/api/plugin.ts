import type { Legend } from './legend/legend';

/**
 * There is no existing runtime plugin mechanism in this repo to adapt - no
 * origo.use(), no plugin loader, no plugins/ directory. Today "plugins" are
 * separate repos a host page imports and wires up by hand (see
 * PLUGINS.md). This module is net-new surface, not a wrapper over existing
 * code.
 *
 * Open design question, not yet resolved: how a plugin gets discovered and
 * loaded at runtime in a standard way (vs. today's ad hoc host-page wiring)
 * - worth a follow-up design pass before Phase 5 (the origo.use() facade)
 * is planned in detail.
 */

/** Provisional - full shape designed in Phase 5. */
export interface MapApi {
  // view, projection, addInteraction, on('click' | 'movestart' | ...)
  on(event: string, fn: (e: CustomEvent) => void): () => void;
}

/** Provisional - full shape designed in Phase 5. */
export interface LayerApi {
  // getLayer(name), getLayers(), addLayer(def), events
  on(event: string, fn: (e: CustomEvent) => void): () => void;
}

/** Provisional - full shape designed in Phase 5. */
export interface UiApi {
  // registerControl(slot, element: HTMLElement), panels, notifications
  registerControl(slot: string, element: HTMLElement): void;
}

/**
 * Today's real config is an untyped plain object assembled ad hoc in
 * origo.js's Origo() factory - no existing typed shape to reuse.
 * Provisional - full shape designed in Phase 5.
 */
export interface ViewerConfig {
  [key: string]: unknown;
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
  /** Called once when the viewer is ready. May be async. */
  init(api: OrigoApi): void | Promise<void>;
  /** Teardown - must remove listeners, DOM, interactions. */
  destroy?(): void;
}

// registration (Phase 5, not implemented here):
// origo.use(myPlugin);
