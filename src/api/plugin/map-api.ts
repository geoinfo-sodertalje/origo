import type Interaction from 'ol/interaction/Interaction';
import type { MapApi, MapEventType } from './plugin';
import type { RawViewer } from './raw';

/**
 * Thin object wrapping viewer.getMap() (a real ol/Map) - not a new class
 * hierarchy like Layer, since a plugin needs only a narrow, capability-
 * scoped slice of what OL's Map already exposes.
 */
/**
 * OL's Map.on() is overloaded per-event-key with a matching per-event
 * listener signature - too specific for a single generic bridge like this
 * one to satisfy directly. Narrowed to the loose shape actually needed
 * here (real behavior is correct either way; this is purely TS overload
 * resolution friction).
 */
interface LooseOlEventSource {
  on(type: string, listener: (e: unknown) => void): void;
  un(type: string, listener: (e: unknown) => void): void;
}

export function createMapApi(viewer: RawViewer): MapApi {
  const map = viewer.getMap();
  const eventSource = map as unknown as LooseOlEventSource;

  return {
    getView: () => map.getView(),
    getProjection: () => map.getView().getProjection(),
    addInteraction: (interaction: Interaction) => map.addInteraction(interaction),
    removeInteraction: (interaction: Interaction) => map.removeInteraction(interaction),
    on(event: MapEventType, fn: (e: CustomEvent) => void): () => void {
      const listener = (olEvent: unknown) => fn(new CustomEvent(event, { detail: olEvent }));
      eventSource.on(event, listener);
      return () => eventSource.un(event, listener);
    },
    getOlMap: () => map
  };
}
