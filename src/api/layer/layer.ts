import type OlBaseLayer from 'ol/layer/Base';
import { TypedEmitter } from '../typed-emitter';
import type { BackendType } from '../interfaces/backend-type';

export interface LayerOptions {
  name: string;
  title: string;
  group?: string;
  visible?: boolean;
  queryable?: boolean;
  minScale?: number;
  maxScale?: number;
  attribution?: string;
  /**
   * OGC server dialect for this layer's source, e.g. for GetFeatureInfo
   * formatting. 'ogc' means pure-spec/no-vendor-quirks; unset means
   * unknown (today's ad hoc fallback behavior). Not yet consumed anywhere.
   */
  backendType?: BackendType;
}

export type LayerEventMap = {
  'change:visible': { visible: boolean };
  'change:opacity': { opacity: number };
  sourceerror: { error: Error };
};

/**
 * Abstract base wrapping an OL layer. Subclasses per type (WmsLayer,
 * WfsLayer, VectorLayer, WmtsLayer, RasterLayer, AgsTileLayer, GroupLayer)
 * live alongside this file; the factory adapter creating these from
 * existing layer factory output is in layer-factory.ts.
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

  abstract get type(): 'wms' | 'wfs' | 'vector' | 'wmts' | 'group' | 'raster';

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

  /**
   * Reflects whatever config survived onto the OL layer - the real layer
   * factory (src/layer.js + src/layer/*.js) passes its entire resolved
   * options object into each OL layer's constructor, and OL's BaseObject
   * retains every constructor key as a gettable property (the same
   * mechanism type/group/queryable already rely on). Best-effort, not a
   * guaranteed exact round-trip: OL consumes/transforms some keys during
   * construction (style becomes a real OL style function, source becomes
   * an actual ol/source instance), so this is for introspection, not a
   * substitute for the original config literal.
   */
  getConfig(): Readonly<Record<string, unknown>> {
    return this.olLayer.getProperties();
  }

  on<K extends keyof LayerEventMap & string>(
    ev: K,
    fn: (e: LayerEventMap[K]) => void
  ): () => void {
    return this.emitter.on(ev, (e) => fn(e.detail));
  }
}
