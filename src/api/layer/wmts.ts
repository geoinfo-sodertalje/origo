import type TileLayer from 'ol/layer/Tile';
import type WMTS from 'ol/source/WMTS';
import type { Coordinate } from 'ol/coordinate';
import { Layer } from './layer';
import type { QueryableService } from '../interfaces/queryable-service';

/** Wraps WMTS layers produced by src/layer/wmts.js. */
export class WmtsLayer extends Layer<TileLayer<WMTS>> implements QueryableService {
  get type(): 'wmts' {
    return 'wmts';
  }

  /**
   * Stubbed until Layer gains a viewer/context reference (Phase 5). The real
   * implementation delegates to a companion 'featureinfoLayer' looked up on
   * the viewer (see src/getfeatureinfo.js) - see QueryableService.
   */
  getFeatureInfoUrl(_coordinate: Coordinate, _resolution: number, _projection: string): Promise<unknown[]> | undefined {
    return undefined;
  }
}
