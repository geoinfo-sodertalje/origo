import { describe, it, expect, vi } from 'vitest';
import { PluginRegistry } from './registry';
import { createReadyTestViewer } from '../../test-utils/create-test-viewer';
import type { OrigoApi, OrigoPlugin } from './plugin';

/**
 * Registry lifecycle tests against real viewers (not hand-mocked fakes) -
 * createOrigoApi touches real viewer/legend/map machinery internally, and
 * this project's established practice this session is to prefer real
 * objects over guessed-at fakes wherever feasible. OrigoPlugin objects
 * themselves ARE fakes (with init/destroy spies) since that's our own
 * interface under test, not Origo internals.
 */
function fakePlugin(name: string) {
  return {
    name,
    init: vi.fn<(api: OrigoApi) => void>(),
    destroy: vi.fn<() => void>()
  } satisfies OrigoPlugin;
}

describe('PluginRegistry', () => {
  it('use() before any viewer exists does not call init yet', () => {
    const registry = new PluginRegistry();
    const plugin = fakePlugin('a');

    registry.use(plugin);

    expect(plugin.init).not.toHaveBeenCalled();
  });

  it('onViewerChange() calls init with a real OrigoApi for every registered plugin', async () => {
    const registry = new PluginRegistry();
    const plugin = fakePlugin('a');
    registry.use(plugin);

    const viewer = await createReadyTestViewer();
    registry.onViewerChange(viewer);

    expect(plugin.init).toHaveBeenCalledTimes(1);
    const api = plugin.init.mock.calls[0][0] as OrigoApi;
    expect(api.version).toBe('1.0.0');
    expect(typeof api.map.getView).toBe('function');
    expect(typeof api.layers.getLayers).toBe('function');
    expect(typeof api.ui.registerControl).toBe('function');
  });

  it('use() registered after a viewer is already active calls init immediately', async () => {
    const registry = new PluginRegistry();
    const viewer = await createReadyTestViewer();
    registry.onViewerChange(viewer);

    const latePlugin = fakePlugin('late');
    registry.use(latePlugin);

    expect(latePlugin.init).toHaveBeenCalledTimes(1);
  });

  it('a later onViewerChange() destroys against the old api then reinits with a fresh one (viewer-rebuild policy)', async () => {
    const registry = new PluginRegistry();
    const plugin = fakePlugin('a');
    registry.use(plugin);

    const viewerA = await createReadyTestViewer();
    registry.onViewerChange(viewerA);
    const apiA = plugin.init.mock.calls[0][0] as OrigoApi;

    const viewerB = await createReadyTestViewer();
    registry.onViewerChange(viewerB);

    expect(plugin.destroy).toHaveBeenCalledTimes(1);
    expect(plugin.init).toHaveBeenCalledTimes(2);
    const apiB = plugin.init.mock.calls[1][0] as OrigoApi;
    expect(apiB).not.toBe(apiA);
  });

  it('a throwing destroy() does not block teardown/reinit of the other plugins', async () => {
    const registry = new PluginRegistry();
    const throwingPlugin = fakePlugin('throws');
    throwingPlugin.destroy.mockImplementation(() => {
      throw new Error('boom');
    });
    const wellBehavedPlugin = fakePlugin('fine');
    registry.use(throwingPlugin);
    registry.use(wellBehavedPlugin);

    const viewerA = await createReadyTestViewer();
    registry.onViewerChange(viewerA);
    const viewerB = await createReadyTestViewer();

    expect(() => registry.onViewerChange(viewerB)).not.toThrow();
    expect(throwingPlugin.destroy).toHaveBeenCalledTimes(1);
    expect(wellBehavedPlugin.destroy).toHaveBeenCalledTimes(1);
    expect(wellBehavedPlugin.init).toHaveBeenCalledTimes(2);
  });
});
