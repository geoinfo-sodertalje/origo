import type { Coordinate } from 'ol/coordinate';

/**
 * Capability shared by layer types that support a server round-trip
 * GetFeatureInfo/Identify request - WMS, WMTS, AGS_TILE today (see
 * src/getfeatureinfo.js:getGetFeatureInfoRequest). Orthogonal to the
 * Layer.type bucket hierarchy: a second, cross-cutting axis, not a
 * replacement for it.
 */
export interface QueryableService {
  /**
   * Stubbed until Layer gains a viewer/context reference (Phase 5) - the
   * real implementation needs resolution, projection, and the viewer
   * (mapSource lookups, vendor-specific formatting). Returns undefined
   * until then.
   */
  getFeatureInfoUrl(
    coordinate: Coordinate,
    resolution: number,
    projection: string
  ): Promise<unknown[]> | undefined;
}
