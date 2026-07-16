import Viewer from '../viewer';
import Localization from '../controls/localization';

/**
 * Boots a real Viewer (not a mock) against a minimal config, for
 * characterization tests of the real layer factory (src/layer.js +
 * src/layer/*.js), which take a real viewer and call real viewer methods
 * (getProjection, getExtent, getMapSource, ...). Calls Viewer directly, not
 * origo.js's full Origo() factory - controls aren't needed to construct
 * layers, only for control-dependent work like the Legend adapter (Phase 4,
 * not yet using this helper).
 *
 * Viewer's Component onInit runs synchronously (Component dispatches 'init'
 * synchronously at construction - see src/ui/component.js), so map/
 * projection/tileGrid are ready immediately after this returns. The
 * config's own `layers` option is loaded asynchronously in the background
 * (mergeSavedLayerProps(...).then(...)) - irrelevant here since tests add
 * their own layers via viewer.addLayer() after construction, so keep
 * `layers: []` in the base config to avoid unrelated async noise.
 */
export function createTestViewer(options: Record<string, unknown> = {}) {
  document.body.innerHTML = '<div id="map"></div>';

  // origo.js sets .options on every control instance after creating it
  // (viewer.js's addControl reads control.options.hideWhenEmbedded) -
  // replicate that single assignment since we're bypassing origo.js.
  const localizationOptions = { localeId: 'sv-SE' };
  const localization = Localization(localizationOptions);
  (localization as unknown as { options: unknown }).options = localizationOptions;

  const baseConfig = {
    breakPoints: {
      xs: [240, 320],
      s: [320, 320],
      m: [500, 500],
      l: [768, 500]
    },
    breakPointsPrefix: 'o-media',
    projectionCode: 'EPSG:3857',
    projectionExtent: [-20026376.39, -20048966.1, 20026376.39, 20048966.1],
    extent: [-20026376.39, -20048966.1, 20026376.39, 20048966.1],
    center: [1810000, 8390000],
    zoom: 5.7,
    resolutions: [
      156543.03, 78271.52, 39135.76, 19567.88, 9783.94, 4891.97, 2445.98,
      1222.99, 611.5, 305.75, 152.87, 76.437, 38.219, 19.109, 9.5546,
      4.7773, 2.3887, 1.1943, 0.5972
    ],
    source: {
      local: {
        url: 'http://localhost/geoserver/wms'
      }
    },
    groups: [
      { name: 'background', title: 'Background', expanded: true }
    ],
    layers: [],
    controls: [localization],
    featureinfoOptions: { infowindow: 'overlay' },
    styles: {
      default: [[{ circle: { radius: 4, fill: { color: 'rgba(0,0,0,1)' } } }]]
    }
  };

  // eslint-disable-next-line new-cap
  return Viewer('#map', Object.assign({}, baseConfig, options));
}
