import type OlVectorLayer from 'ol/layer/Vector';
import type VectorImageLayer from 'ol/layer/VectorImage';
import type VectorTileLayer from 'ol/layer/VectorTile';
import { Layer } from './layer';

/**
 * Wraps the vector-source-backed layer types: GEOJSON, KML, GPX, TOPOJSON,
 * FEATURE, AGS_FEATURE, VECTORTILE (all go through src/layer/vector.js,
 * which picks ol/layer/Vector, VectorImage, or VectorTile depending on
 * layerType/cluster/vectortile options).
 */
export class VectorLayer extends Layer<OlVectorLayer | VectorImageLayer | VectorTileLayer> {
  get type(): 'vector' {
    return 'vector';
  }
}
