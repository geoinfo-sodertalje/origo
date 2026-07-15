/**
 * OGC server dialect a layer's source talks to. 'ogc' is an explicit
 * declaration of pure-spec/no-vendor-quirks behavior, distinct from leaving
 * a layer's backendType unset (unknown - today's ad hoc fallback behavior
 * in getfeatureinfo.js/print-resize.js is unaffected by this type existing).
 */
export type BackendType = 'geoserver' | 'qgis' | 'mapserver' | 'arcgis' | 'ogc';
