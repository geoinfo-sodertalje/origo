import { wrapLegend } from '../legend/factory';
import type { OrigoApi, ViewerConfig } from './plugin';
import type { RawViewer } from './raw';
import { createMapApi } from './map-api';
import { createLayerApi } from './layer-api';
import { createUiApi } from './ui-api';

const PLUGIN_API_VERSION = '1.0.0';

/** Composes the capability-scoped OrigoApi a plugin actually receives - never the raw viewer. */
export function createOrigoApi(viewer: RawViewer): OrigoApi {
  const legendControl = viewer.getControlByName('legend');
  if (!legendControl) {
    throw new Error('createOrigoApi: no "legend" control configured on this viewer - Phase 5 requires one, same as wrapLegend()');
  }

  return {
    version: PLUGIN_API_VERSION,
    map: createMapApi(viewer),
    layers: createLayerApi(viewer),
    legend: wrapLegend(legendControl, viewer),
    ui: createUiApi(viewer),
    config: viewer.getViewerOptions() as Readonly<ViewerConfig>
  };
}
