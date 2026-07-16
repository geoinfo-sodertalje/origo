import { describe, it, expect } from 'vitest';
import LegendControl from '../../controls/legend';
import { createTestViewer, createTestLocalization, waitForLoaded } from '../../test-utils/create-test-viewer';
import { wrapLegend } from './factory';

/**
 * Characterization + adapter tests for LegendAdapter, against the real
 * legend control (src/controls/legend.js) - no mocking of legend.js itself.
 * Legend needs the fuller addControls()/'loaded' flow (unlike the bare-
 * Viewer Layer tests), since its groups/layers are only built once it's
 * actually added as a component - see waitForLoaded() and its docstring.
 */
async function setupLegend() {
  const localization = createTestLocalization();
  // eslint-disable-next-line new-cap
  const legend = LegendControl({ localization, useGroupIndication: true });

  const viewer = createTestViewer({
    groups: [
      { name: 'background', title: 'Background', expanded: true },
      { name: 'mygroup', title: 'My Group', expanded: false },
      { name: 'mysubgroup', title: 'My Subgroup', parent: 'mygroup', type: 'grouplayer', expanded: false }
    ]
  }, [legend]);

  // Added before addControls() runs (inside the async init chain awaited
  // below), so Overlays' own readOverlays() picks them up at construction.
  viewer.addLayer({
    name: 'grouped-geojson',
    title: 'Grouped GeoJSON',
    group: 'mysubgroup',
    source: 'data/origo-cities-3857.geojson',
    style: 'default',
    type: 'GEOJSON',
    visible: true
  });

  await waitForLoaded(viewer);

  const legendControl = viewer.getControlByName('legend');
  const legendApi = wrapLegend(legendControl, viewer);
  return { viewer, legendApi };
}

describe('LegendAdapter', () => {
  it('getGroups() excludes background/none, includes real groups with wrapped layers', async () => {
    const { legendApi } = await setupLegend();
    const groups = legendApi.getGroups();

    expect(groups.map((g) => g.name)).toEqual(['mygroup']);
    expect(groups[0].expanded).toBe(false);
    expect(groups[0].groups).toHaveLength(1);
    expect(groups[0].groups[0].name).toBe('mysubgroup');
    expect(groups[0].groups[0].layers).toHaveLength(1);
    expect(groups[0].groups[0].layers[0].name).toBe('grouped-geojson');
    expect(groups[0].groups[0].layers[0].type).toBe('vector');
  });

  it('getGroup(name) finds a nested group directly, not just via the tree', async () => {
    const { legendApi } = await setupLegend();
    const subgroup = legendApi.getGroup('mysubgroup');

    expect(subgroup).toBeDefined();
    expect(subgroup?.layers).toHaveLength(1);
  });

  it('expandGroup/collapseGroup change reported state', async () => {
    const { legendApi } = await setupLegend();

    expect(legendApi.getGroup('mygroup')?.expanded).toBe(false);
    legendApi.expandGroup('mygroup');
    expect(legendApi.getGroup('mygroup')?.expanded).toBe(true);
    legendApi.collapseGroup('mygroup');
    expect(legendApi.getGroup('mygroup')?.expanded).toBe(false);
  });

  it('emits group:expand/group:collapse via the MutationObserver, not just on read', async () => {
    const { legendApi } = await setupLegend();
    const events: string[] = [];
    legendApi.on('group:expand', (e) => events.push(`expand:${e.group.name}`));
    legendApi.on('group:collapse', (e) => events.push(`collapse:${e.group.name}`));

    legendApi.expandGroup('mygroup');
    // MutationObserver callbacks run as a microtask, not synchronously.
    await Promise.resolve();
    expect(events).toContain('expand:mygroup');

    legendApi.collapseGroup('mygroup');
    await Promise.resolve();
    expect(events).toContain('collapse:mygroup');
  });

  it('calling expandGroup when already expanded is a safe no-op (no duplicate event)', async () => {
    const { legendApi } = await setupLegend();
    legendApi.expandGroup('mygroup');
    await Promise.resolve();

    const events: string[] = [];
    legendApi.on('group:expand', (e) => events.push(e.group.name));
    legendApi.expandGroup('mygroup');
    await Promise.resolve();
    expect(events).toHaveLength(0);
  });

  it('emits layer:toggle from the raw OL layer visibility change, not just Layer.setVisible()', async () => {
    const { legendApi } = await setupLegend();
    const layer = legendApi.getGroup('mysubgroup')?.layers[0];
    expect(layer).toBeDefined();

    const events: Array<{ visible: boolean }> = [];
    legendApi.on('layer:toggle', (e) => events.push({ visible: e.visible }));

    // Simulates the legend's own checkbox (src/controls/legend/overlay.js),
    // which calls setVisible() on the raw OL layer directly - not through
    // the Layer wrapper's own setVisible().
    layer?.getOlLayer().setVisible(false);

    expect(events).toEqual([{ visible: false }]);
  });

  it('render bridges the old Eventer dispatch to the TypedEmitter', async () => {
    const { viewer, legendApi } = await setupLegend();
    const events: unknown[] = [];
    legendApi.on('render', (e) => events.push(e));

    const legendControl = viewer.getControlByName('legend') as { dispatch(type: string): void };
    legendControl.dispatch('render');

    expect(events).toHaveLength(1);
  });
});
