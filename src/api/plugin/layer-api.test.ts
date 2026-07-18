import { describe, it, expect } from 'vitest';
import { createLayerApi } from './layer-api';
import { createReadyTestViewer } from '../../test-utils/create-test-viewer';
import { VectorLayer } from '../layer/vector';

describe('createLayerApi', () => {
  it('addLayer()/getLayer() return Phase 3 Layer wrappers, not raw OL layers', async () => {
    const viewer = await createReadyTestViewer();
    const layerApi = createLayerApi(viewer);

    const added = layerApi.addLayer({
      name: 'geojson-layer',
      title: 'GeoJSON',
      group: 'root',
      source: 'data/origo-cities-3857.geojson',
      style: 'default',
      type: 'GEOJSON'
    });

    expect(added).toBeInstanceOf(VectorLayer);
    expect(added?.name).toBe('geojson-layer');

    const fetched = layerApi.getLayer('geojson-layer');
    expect(fetched).toBeInstanceOf(VectorLayer);
  });

  it('getLayers() returns every layer wrapped', async () => {
    const viewer = await createReadyTestViewer();
    const layerApi = createLayerApi(viewer);

    layerApi.addLayer({
      name: 'osm-layer', title: 'OSM', group: 'background', style: 'default', type: 'OSM'
    });

    const layers = layerApi.getLayers();
    expect(layers.some((l) => l.name === 'osm-layer')).toBe(true);
    layers.forEach((l) => expect(typeof l.getConfig).toBe('function'));
  });

  it('on("addlayer"/"removelayer") bridges the real viewer dispatch', async () => {
    const viewer = await createReadyTestViewer();
    const layerApi = createLayerApi(viewer);

    const added: string[] = [];
    const unsubscribe = layerApi.on('addlayer', (e) => added.push(e.detail.layerName));

    layerApi.addLayer({
      name: 'geojson-layer', title: 'GeoJSON', group: 'root', source: 'data/origo-cities-3857.geojson', style: 'default', type: 'GEOJSON'
    });
    expect(added).toEqual(['geojson-layer']);

    unsubscribe();
    layerApi.addLayer({
      name: 'geojson-layer-2', title: 'GeoJSON 2', group: 'root', source: 'data/origo-cities-3857.geojson', style: 'default', type: 'GEOJSON'
    });
    expect(added).toEqual(['geojson-layer']);
  });

  it('getLayer() for an unknown name returns undefined, not throwing', async () => {
    const viewer = await createReadyTestViewer();
    const layerApi = createLayerApi(viewer);

    expect(layerApi.getLayer('does-not-exist')).toBeUndefined();
  });
});
