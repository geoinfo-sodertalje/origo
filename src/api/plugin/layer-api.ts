import type { LayerApi, LayerApiEventType } from './plugin';
import type { Layer } from '../layer/layer';
import { wrapLayer } from '../layer/factory';
import type { RawViewer, RawLayerEvent } from './raw';

/** Ties directly into Phase 3's wrapLayer - every returned Layer is a typed wrapper, never a raw OL layer. */
export function createLayerApi(viewer: RawViewer): LayerApi {
  return {
    getLayer(name: string): Layer | undefined {
      const olLayer = viewer.getLayer(name);
      return olLayer ? wrapLayer(olLayer) : undefined;
    },
    getLayers(): Layer[] {
      return viewer.getLayers()
        .map((olLayer) => wrapLayer(olLayer))
        .filter((layer): layer is Layer => layer !== undefined);
    },
    addLayer(def: Record<string, unknown>): Layer | undefined {
      return wrapLayer(viewer.addLayer(def));
    },
    on(event: LayerApiEventType, fn: (e: CustomEvent<{ layerName: string }>) => void): () => void {
      const listener = (data: RawLayerEvent) => fn(new CustomEvent(event, { detail: data }));
      viewer.on(event, listener);
      return () => viewer.un(event, listener);
    }
  };
}
