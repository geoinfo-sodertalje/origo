import type { Legend } from './legend';
import type { RawLegendControl, RawViewerEventSource } from './raw';
import { LegendAdapter } from './adapter';

/**
 * Wraps an already-instantiated legend control (viewer.getControlByName
 * ('legend')) - not wired into anything automatically, same posture as
 * wrapLayer(). Unlike wrapLayer(olLayer), this needs the viewer passed in
 * separately: neither legend.js's nor Overlays' returned Component exposes
 * a getViewer(), and the viewer reference is needed for
 * viewer.on('add:group' | 'remove:group', ...).
 */
export function wrapLegend(legendControl: RawLegendControl, viewer: RawViewerEventSource): Legend {
  return new LegendAdapter(legendControl, viewer);
}
