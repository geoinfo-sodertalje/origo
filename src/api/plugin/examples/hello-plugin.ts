import type { OrigoApi, OrigoPlugin } from '../plugin';

/**
 * Small, from-scratch proof plugin demonstrating the full OrigoPlugin
 * contract end-to-end - not a port of the external barebone-plugin
 * (different repo/license), just a comparable minimal example. Not wired
 * into any HTML page - same pure-addition posture as Phases 3-4.
 */
export function createHelloPlugin(): OrigoPlugin {
  let button: HTMLButtonElement | undefined;
  let clickHandler: (() => void) | undefined;

  return {
    name: 'hello-plugin',
    init(api: OrigoApi): void {
      button = document.createElement('button');
      button.textContent = 'Hello';
      clickHandler = () => {
        const zoom = api.map.getView().getZoom();
        const layerCount = api.layers.getLayers().length;
        // eslint-disable-next-line no-console
        console.log(`hello-plugin: zoom=${zoom}, layers=${layerCount}`);
      };
      button.addEventListener('click', clickHandler);
      api.ui.registerControl('navigation', button);
    },
    destroy(): void {
      if (button && clickHandler) {
        button.removeEventListener('click', clickHandler);
      }
      button = undefined;
      clickHandler = undefined;
    }
  };
}
