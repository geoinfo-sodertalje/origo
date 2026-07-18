import { describe, it, expect } from 'vitest';
import { createUiApi } from './ui-api';
import { createReadyTestViewer } from '../../test-utils/create-test-viewer';

describe('createUiApi', () => {
  it('registerControl("navigation", element) appends the live element into the real navigation container', async () => {
    const viewer = await createReadyTestViewer();
    const uiApi = createUiApi(viewer);
    const button = document.createElement('button');
    button.textContent = 'Hello';

    uiApi.registerControl('navigation', button);

    const containerId = viewer.getMain().getNavigation().getId();
    const container = document.getElementById(containerId);
    expect(container?.contains(button)).toBe(true);
  });

  it.each(['maptools', 'misctools', 'bottomtools'] as const)(
    'registerControl("%s", element) targets the matching real container',
    async (slot) => {
      const viewer = await createReadyTestViewer();
      const uiApi = createUiApi(viewer);
      const element = document.createElement('div');

      uiApi.registerControl(slot, element);

      const getters = {
        maptools: () => viewer.getMain().getMapTools(),
        misctools: () => viewer.getMain().getMiscTools(),
        bottomtools: () => viewer.getMain().getBottomTools()
      } as const;
      const containerId = getters[slot]().getId();
      expect(document.getElementById(containerId)?.contains(element)).toBe(true);
    }
  );

  it('registerControl("sidebar", element) delegates to the real sidebar singleton', async () => {
    const viewer = await createReadyTestViewer();
    const uiApi = createUiApi(viewer);
    const element = document.createElement('div');
    element.innerHTML = '<span>plugin content</span>';

    uiApi.registerControl('sidebar', element);

    expect(document.querySelector('#o-sidebar .o-card-content')?.innerHTML).toContain('plugin content');
  });

  it('an element registered to a real slot preserves live listeners (unlike sidebar)', async () => {
    const viewer = await createReadyTestViewer();
    const uiApi = createUiApi(viewer);
    const button = document.createElement('button');
    let clicked = false;
    button.addEventListener('click', () => { clicked = true; });

    uiApi.registerControl('navigation', button);
    button.click();

    expect(clicked).toBe(true);
  });
});
