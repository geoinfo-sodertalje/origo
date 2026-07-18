import { describe, it, expect } from 'vitest';
import TileLayer from 'ol/layer/Tile';
import ImageLayer from 'ol/layer/Image';
import OlVectorLayer from 'ol/layer/Vector';
import OlLayerGroup from 'ol/layer/Group';
import { createTestViewer } from '../test-utils/create-test-viewer';
import { wrapLayer } from '../api/layer/factory';
import { WmsLayer } from '../api/layer/wms';
import { WfsLayer } from '../api/layer/wfs';
import { VectorLayer } from '../api/layer/vector';
import { RasterLayer } from '../api/layer/raster';
import { AgsTileLayer } from '../api/layer/ags-tile';
import { GroupLayer } from '../api/layer/group';

/**
 * Characterization tests for the real, untouched layer factory
 * (src/layer.js + src/layer/*.js) - one per Phase 3 bucket, asserting
 * actual OL construction behavior (not a mock), each paired with a
 * wrapLayer() assertion validating Phase 3's adapter against real output.
 * See the "Test infrastructure" plan for why: these exist to build a
 * safety net before deciding whether to rewrite this subsystem's internals.
 */
describe('layer factory characterization', () => {
  it('WMS tile mode (renderMode default) -> TileLayer, wraps as WmsLayer', () => {
    const viewer = createTestViewer();
    const layer = viewer.addLayer({
      name: 'wms-tile',
      title: 'WMS Tile',
      group: 'root',
      source: 'local',
      id: 'wms_tile_id',
      type: 'WMS'
    });

    expect(layer).toBeInstanceOf(TileLayer);
    expect(layer.get('type')).toBe('WMS');

    const wrapped = wrapLayer(layer);
    expect(wrapped).toBeInstanceOf(WmsLayer);
    expect(wrapped?.type).toBe('wms');
  });

  it('WMS image mode (renderMode: image) -> ImageLayer, wraps as WmsLayer', () => {
    const viewer = createTestViewer();
    const layer = viewer.addLayer({
      name: 'wms-image',
      title: 'WMS Image',
      group: 'root',
      source: 'local',
      id: 'wms_image_id',
      renderMode: 'image',
      type: 'WMS'
    });

    expect(layer).toBeInstanceOf(ImageLayer);
    expect(layer.get('type')).toBe('WMS');

    const wrapped = wrapLayer(layer);
    expect(wrapped).toBeInstanceOf(WmsLayer);
    expect(wrapped?.type).toBe('wms');
  });

  it('WFS -> Vector layer, wraps as WfsLayer', () => {
    const viewer = createTestViewer();
    const layer = viewer.addLayer({
      name: 'wfs-layer',
      title: 'WFS',
      group: 'root',
      source: 'local',
      id: 'wfs_id',
      type: 'WFS'
    });

    expect(layer).toBeInstanceOf(OlVectorLayer);
    expect(layer.get('type')).toBe('WFS');

    const wrapped = wrapLayer(layer);
    expect(wrapped).toBeInstanceOf(WfsLayer);
    expect(wrapped?.type).toBe('wfs');
  });

  it('GEOJSON (vector bucket representative) -> Vector layer, wraps as VectorLayer', () => {
    const viewer = createTestViewer();
    const layer = viewer.addLayer({
      name: 'geojson-layer',
      title: 'GeoJSON',
      group: 'root',
      source: 'data/origo-cities-3857.geojson',
      style: 'default',
      type: 'GEOJSON'
    });

    expect(layer).toBeInstanceOf(OlVectorLayer);
    expect(layer.get('type')).toBe('GEOJSON');

    const wrapped = wrapLayer(layer);
    expect(wrapped).toBeInstanceOf(VectorLayer);
    expect(wrapped?.type).toBe('vector');
  });

  it('OSM (raster bucket representative) -> TileLayer, wraps as RasterLayer', () => {
    const viewer = createTestViewer();
    const layer = viewer.addLayer({
      name: 'osm-layer',
      title: 'OSM',
      group: 'background',
      style: 'default',
      type: 'OSM'
    });

    expect(layer).toBeInstanceOf(TileLayer);
    expect(layer.get('type')).toBe('OSM');

    const wrapped = wrapLayer(layer);
    expect(wrapped).toBeInstanceOf(RasterLayer);
    expect(wrapped?.type).toBe('raster');
  });

  it('AGS_TILE -> TileLayer, wraps as AgsTileLayer (QueryableService)', () => {
    const viewer = createTestViewer();
    const layer = viewer.addLayer({
      name: 'ags-tile-layer',
      title: 'AGS Tile',
      group: 'root',
      source: 'local',
      id: '0',
      type: 'AGS_TILE'
    });

    expect(layer).toBeInstanceOf(TileLayer);
    expect(layer.get('type')).toBe('AGS_TILE');

    const wrapped = wrapLayer(layer);
    expect(wrapped).toBeInstanceOf(AgsTileLayer);
    expect(wrapped?.type).toBe('raster');
    // AgsTileLayer implements QueryableService - stubbed this phase (Phase 3),
    // still asserting the method exists with the right shape.
    expect(typeof (wrapped as AgsTileLayer).getFeatureInfoUrl).toBe('function');
  });

  it('GROUP with a nested layer -> ol/layer/Group, wraps as GroupLayer with live children', () => {
    const viewer = createTestViewer();
    const layer = viewer.addLayer({
      name: 'group-layer',
      title: 'Group',
      group: 'root',
      type: 'GROUP',
      layers: [
        {
          name: 'nested-geojson',
          title: 'Nested GeoJSON',
          source: 'data/origo-cities-3857.geojson',
          style: 'default',
          type: 'GEOJSON'
        }
      ]
    });

    expect(layer).toBeInstanceOf(OlLayerGroup);
    expect(layer.get('type')).toBe('GROUP');

    const wrapped = wrapLayer(layer);
    expect(wrapped).toBeInstanceOf(GroupLayer);
    expect(wrapped?.type).toBe('group');

    const group = wrapped as GroupLayer;
    expect(group.children).toHaveLength(1);
    expect(group.children[0]).toBeInstanceOf(VectorLayer);

    // Live sync: adding a sub-layer to the OL group after construction is
    // reflected without re-wrapping (Phase 3's design, not eager-once).
    const olGroup = layer as OlLayerGroup;
    const extraOlLayer = viewer.addLayer({
      name: 'extra-in-group',
      title: 'Extra',
      style: 'default',
      type: 'OSM'
    });
    olGroup.getLayers().push(extraOlLayer);
    expect(group.children).toHaveLength(2);
  });

  it('wrapLayer returns undefined for a layer with no recognized type', () => {
    const viewer = createTestViewer();
    const layer = viewer.addLayer({
      name: 'osm-untyped',
      title: 'OSM',
      style: 'default',
      type: 'OSM'
    });
    layer.unset('type');

    expect(wrapLayer(layer)).toBeUndefined();
  });

  it('getConfig() reflects real constructor options (Phase 5 addition)', () => {
    const viewer = createTestViewer();
    const layer = viewer.addLayer({
      name: 'wms-tile',
      title: 'WMS Tile',
      group: 'root',
      opacity: 0.5,
      source: 'local',
      id: 'wms_tile_id',
      type: 'WMS'
    });

    const wrapped = wrapLayer(layer);
    const config = wrapped?.getConfig();

    expect(config?.group).toBe('root');
    expect(config?.opacity).toBe(0.5);
    expect(config?.type).toBe('WMS');
  });
});
