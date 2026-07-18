import { describe, it, expect } from 'vitest';
import { createMapApi } from './map-api';
import { createReadyTestViewer } from '../../test-utils/create-test-viewer';

describe('createMapApi', () => {
  it('getView()/getProjection() reflect the real viewer map', async () => {
    const viewer = await createReadyTestViewer();
    const mapApi = createMapApi(viewer);

    expect(mapApi.getView()).toBe(viewer.getMap().getView());
    expect(mapApi.getProjection()?.getCode()).toBe('EPSG:3857');
  });

  it('getOlMap() is the same real OL map instance (escape hatch)', async () => {
    const viewer = await createReadyTestViewer();
    const mapApi = createMapApi(viewer);

    expect(mapApi.getOlMap()).toBe(viewer.getMap());
  });

  it('on()/unsubscribe bridges the real OL map event, not a fake one', async () => {
    const viewer = await createReadyTestViewer();
    const mapApi = createMapApi(viewer);
    const map = viewer.getMap();

    // 'movestart'/'moveend' are normally driven by OL's render loop during
    // an animation, which needs real rAF pumping jsdom doesn't do - dispatch
    // directly on the real map instead, still exercising OL's real event
    // system (Observable.dispatchEvent), just not via a full animation.
    const events: CustomEvent[] = [];
    const unsubscribe = mapApi.on('moveend', (e) => events.push(e));

    map.dispatchEvent('moveend');
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(CustomEvent);

    unsubscribe();
    map.dispatchEvent('moveend');
    expect(events).toHaveLength(1);
  });
});
