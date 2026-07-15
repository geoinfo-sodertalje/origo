import type OlBaseLayer from 'ol/layer/Base';
import { Layer, type LayerOptions } from './layer';
import { WmsLayer } from './wms';
import { WfsLayer } from './wfs';
import { WmtsLayer } from './wmts';
import { VectorLayer } from './vector';
import { RasterLayer } from './raster';
import { AgsTileLayer } from './ags-tile';
import { GroupLayer } from './group';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LayerConstructor = new (options: LayerOptions, olLayer: any) => Layer;

/**
 * Raw origo `type` string (olLayer.get('type')) -> concrete wrapper class.
 * AGS_TILE gets its own class rather than folding into RasterLayer because
 * it's the one raster-bucket type with GetFeatureInfo/Identify support (see
 * QueryableService); everything else in the mapping is one class per
 * architecture.md bucket.
 */
const RAW_TYPE_TO_CTOR: Record<string, LayerConstructor> = {
  WMS: WmsLayer,
  WFS: WfsLayer,
  WMTS: WmtsLayer,
  GROUP: GroupLayer,
  GEOJSON: VectorLayer,
  KML: VectorLayer,
  GPX: VectorLayer,
  TOPOJSON: VectorLayer,
  FEATURE: VectorLayer,
  AGS_FEATURE: VectorLayer,
  VECTORTILE: VectorLayer,
  XYZ: RasterLayer,
  OSM: RasterLayer,
  COG: RasterLayer,
  AGS_MAP: RasterLayer,
  AGS_TILE: AgsTileLayer,
};

/**
 * Wraps a raw OL layer (as produced by src/layer.js's factory) in the
 * matching Layer subclass, dispatching on the origo 'type' property already
 * stamped onto it (not `instanceof` - the same origo type can produce
 * different OL classes depending on renderMode, e.g. WMS/AGS_MAP).
 * Returns undefined for unrecognized/missing types rather than throwing -
 * this must stay safe against a bad/legacy layer once it's wired into a
 * running app.
 */
export function wrapLayer(olLayer: OlBaseLayer): Layer | undefined {
  const rawType = olLayer.get('type') as string | undefined;
  const Ctor = rawType ? RAW_TYPE_TO_CTOR[rawType] : undefined;
  if (!Ctor) {
    console.warn(`wrapLayer: unrecognized or missing origo type "${rawType}" - skipping`);
    return undefined;
  }
  const options: LayerOptions = {
    name: olLayer.get('name') ?? '',
    title: olLayer.get('title') ?? '',
  };
  return new Ctor(options, olLayer);
}
