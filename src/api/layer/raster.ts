import type TileLayer from 'ol/layer/Tile';
import type ImageLayer from 'ol/layer/Image';
import type ImageSource from 'ol/source/Image';
import type WebGLTileLayer from 'ol/layer/WebGLTile';
import { Layer } from './layer';

/**
 * Wraps the raster/tile layer types with no GetFeatureInfo capability:
 * XYZ, OSM, COG, AGS_MAP (src/layer/{xyz,osm,cog,agsmap}.js). AGS_TILE is
 * the one raster-bucket type that IS queryable - see AgsTileLayer.
 */
export class RasterLayer extends Layer<TileLayer | ImageLayer<ImageSource> | WebGLTileLayer> {
  get type(): 'raster' {
    return 'raster';
  }
}
