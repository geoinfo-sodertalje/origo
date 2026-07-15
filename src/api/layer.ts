import type OlBaseLayer from 'ol/layer/Base';
import { TypedEmitter } from './typed-emitter';

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
  sourceerror: { error: Error };
};

/**
 * Abstract base wrapping an OL layer. Subclasses per type (WmsLayer,
 * WfsLayer, VectorLayer, GroupLayer) and the factory adapter creating these
 * from existing layer factory output are Phase 3 - not implemented here.
 */
export abstract class Layer<TOl extends OlBaseLayer = OlBaseLayer> {
  readonly name: string;

  readonly title: string;

  protected olLayer: TOl;

  private emitter = new TypedEmitter<LayerEventMap>();

  constructor(options: LayerOptions, olLayer: TOl) {
    this.name = options.name;
    this.title = options.title;
    this.olLayer = olLayer;
  }

  abstract get type(): 'wms' | 'wfs' | 'vector' | 'wmts' | 'group';

  get visible(): boolean {
    return this.olLayer.getVisible();
  }

  setVisible(v: boolean): void {
    this.olLayer.setVisible(v);
    this.emitter.emit('change:visible', { visible: v });
  }

  /** Escape hatch - typed access to the underlying OL layer */
  getOlLayer(): TOl {
    return this.olLayer;
  }

  on<K extends keyof LayerEventMap & string>(
    ev: K,
    fn: (e: LayerEventMap[K]) => void
  ): () => void {
    return this.emitter.on(ev, (e) => fn(e.detail));
  }
}
