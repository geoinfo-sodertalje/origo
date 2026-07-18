import type OlMap from 'ol/Map';
import type OlBaseLayer from 'ol/layer/Base';
import type { RawLegendControl, RawGroupEvent } from '../legend/raw';

/**
 * Structural types for the untyped src/viewer.js surface this module
 * depends on - no .d.ts exists for it. Mirrors src/api/legend/raw.ts's
 * convention (RawLegendControl/RawGroupEvent reused from there directly).
 * RawViewer's on/un are overloaded per real event rather than extending
 * legend/raw.ts's narrower RawViewerEventSource, since this module also
 * needs viewer's real 'addlayer'/'removelayer' dispatches
 * (src/viewer.js:455,462) that Legend's adapter never needed.
 */

export interface RawMainComponent {
  getNavigation(): { getId(): string };
  getMapTools(): { getId(): string };
  getMiscTools(): { getId(): string };
  getBottomTools(): { getId(): string };
}

export interface RawLayerEvent {
  layerName: string;
}

export interface RawViewer {
  getId(): string;
  getMap(): OlMap;
  getLayer(name: string): OlBaseLayer | undefined;
  getLayers(): OlBaseLayer[];
  addLayer(def: Record<string, unknown>, insertBefore?: OlBaseLayer): OlBaseLayer;
  getMain(): RawMainComponent;
  getViewerOptions(): Record<string, unknown>;
  getControlByName(name: string): RawLegendControl | null;
  on(type: 'add:group' | 'remove:group', listener: (data: RawGroupEvent) => void): void;
  on(type: 'addlayer' | 'removelayer', listener: (data: RawLayerEvent) => void): void;
  un(type: 'add:group' | 'remove:group', listener: (data: RawGroupEvent) => void): void;
  un(type: 'addlayer' | 'removelayer', listener: (data: RawLayerEvent) => void): void;
}
