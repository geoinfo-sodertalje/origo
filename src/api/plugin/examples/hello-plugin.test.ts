import { describe, it, expect, vi } from 'vitest';
import { createHelloPlugin } from './hello-plugin';
import { createOrigoApi } from '../factory';
import { createReadyTestViewer } from '../../../test-utils/create-test-viewer';

describe('hello-plugin (proof plugin)', () => {
  it('init() registers a button in the navigation slot; destroy() removes its listener', async () => {
    const viewer = await createReadyTestViewer();
    const api = createOrigoApi(viewer);
    const plugin = createHelloPlugin();

    plugin.init(api);

    const containerId = viewer.getMain().getNavigation().getId();
    const container = document.getElementById(containerId);
    const button = container?.querySelector('button');
    expect(button).toBeTruthy();
    expect(button?.textContent).toBe('Hello');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    button?.click();
    expect(logSpy).toHaveBeenCalledTimes(1);

    plugin.destroy?.();
    button?.click();
    // No new call after destroy() removed the listener.
    expect(logSpy).toHaveBeenCalledTimes(1);
    logSpy.mockRestore();
  });
});
