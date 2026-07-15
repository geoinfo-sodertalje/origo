import type LayerGroup from 'ol/layer/Group';
import type OlBaseLayer from 'ol/layer/Base';
import type { CollectionEvent } from 'ol/Collection';
import type { ObjectEvent } from 'ol/Object';
import { Layer, type LayerOptions } from './layer';
import { wrapLayer } from './factory';

/**
 * Wraps ol/layer/Group. children is backed by a cache kept live via
 * Collection 'add'/'remove' listeners (rather than eager-once, which goes
 * stale when sub-layers are added/removed after construction, or
 * lazy-per-read, which would break wrapper identity for anything holding a
 * reference/listener on a child). A 'change:layers' listener re-subscribes
 * if the whole collection is swapped via setLayers().
 */
export class GroupLayer extends Layer<LayerGroup> {
  private cache = new Map<OlBaseLayer, Layer>();

  private handleAdd = (e: CollectionEvent<OlBaseLayer>): void => {
    const wrapped = wrapLayer(e.element);
    if (wrapped) this.cache.set(e.element, wrapped);
  };

  private handleRemove = (e: CollectionEvent<OlBaseLayer>): void => {
    const child = this.cache.get(e.element);
    if (child instanceof GroupLayer) child.destroy();
    this.cache.delete(e.element);
  };

  private handleChangeLayers = (): void => {
    this.unsubscribeCollection();
    this.rebuildCache();
    this.subscribeCollection();
  };

  constructor(options: LayerOptions, olLayer: LayerGroup) {
    super(options, olLayer);
    this.rebuildCache();
    this.subscribeCollection();
    this.olLayer.on('change:layers', this.handleChangeLayers as (e: ObjectEvent) => void);
  }

  get type(): 'group' {
    return 'group';
  }

  get children(): Layer[] {
    return Array.from(this.cache.values());
  }

  /** Unsubscribes this group's live listeners, recursively, for nested groups too. */
  destroy(): void {
    this.unsubscribeCollection();
    this.olLayer.un('change:layers', this.handleChangeLayers as (e: ObjectEvent) => void);
    this.cache.forEach((child) => {
      if (child instanceof GroupLayer) child.destroy();
    });
    this.cache.clear();
  }

  private rebuildCache(): void {
    this.cache.clear();
    this.olLayer.getLayers().forEach((child) => {
      const wrapped = wrapLayer(child);
      if (wrapped) this.cache.set(child, wrapped);
    });
  }

  private subscribeCollection(): void {
    this.olLayer.getLayers().on('add', this.handleAdd);
    this.olLayer.getLayers().on('remove', this.handleRemove);
  }

  private unsubscribeCollection(): void {
    this.olLayer.getLayers().un('add', this.handleAdd);
    this.olLayer.getLayers().un('remove', this.handleRemove);
  }
}
