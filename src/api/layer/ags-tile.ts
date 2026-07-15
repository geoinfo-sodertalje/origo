import type TileLayer from 'ol/layer/Tile';
import type TileArcGISRest from 'ol/source/TileArcGISRest';
import type { Coordinate } from 'ol/coordinate';
import { Layer } from './layer';
import type { QueryableService } from '../interfaces/queryable-service';

/**
 * Wraps AGS_TILE layers (src/layer/agstile.js) - always Tile-backed, unlike
 * AGS_MAP which can be Tile- or Image-backed (see RasterLayer). The one
 * raster-bucket type with a GetFeatureInfo-equivalent (Identify) capability,
 * per src/getfeatureinfo.js:getGetFeatureInfoRequest.
 */
export class AgsTileLayer extends Layer<TileLayer<TileArcGISRest>> implements QueryableService {
  get type(): 'raster' {
    return 'raster';
  }

  /**
   * Stubbed until Layer gains a viewer/context reference (Phase 5). The real
   * implementation is an ArcGIS identify request (getAGSIdentifyUrl), not a
   * WMS-style GetFeatureInfo - see QueryableService.
   */
  getFeatureInfoUrl(_coordinate: Coordinate, _resolution: number, _projection: string): Promise<unknown[]> | undefined {
    return undefined;
  }
}
