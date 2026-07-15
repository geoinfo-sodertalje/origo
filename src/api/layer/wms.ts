import type TileLayer from 'ol/layer/Tile';
import type ImageLayer from 'ol/layer/Image';
import type TileWMS from 'ol/source/TileWMS';
import type ImageWMS from 'ol/source/ImageWMS';
import type { Coordinate } from 'ol/coordinate';
import { Layer } from './layer';
import type { QueryableService } from '../interfaces/queryable-service';

/**
 * Wraps WMS layers produced by src/layer/wms.js - Tile- or Image-backed
 * depending on renderMode, the origo 'type' property is 'WMS' either way.
 */
export class WmsLayer extends Layer<TileLayer<TileWMS> | ImageLayer<ImageWMS>> implements QueryableService {
  get type(): 'wms' {
    return 'wms';
  }

  /** Real implementation - both TileWMS and ImageWMS expose getLegendUrl directly. */
  getLegendGraphicUrl(resolution?: number, params?: Record<string, unknown>): string | undefined {
    return this.olLayer.getSource()?.getLegendUrl(resolution, params);
  }

  /** Stubbed until Layer gains a viewer/context reference (Phase 5) - see QueryableService. */
  getFeatureInfoUrl(_coordinate: Coordinate, _resolution: number, _projection: string): Promise<unknown[]> | undefined {
    return undefined;
  }
}
