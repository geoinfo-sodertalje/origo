import type OlBaseLayer from 'ol/layer/Base';

/**
 * Structural types for the untyped JS surface this adapter depends on
 * (src/controls/legend.js + src/controls/legend/*.js - none of it has a
 * .d.ts). Hand-rolled from reading the real return objects, not guessed:
 * see docs/architecture.md's Legend section for the file:line references.
 * Shared between adapter.ts and factory.ts.
 */

/** src/ui/utils/eventer.js's on/un - no unsubscribe return, unlike TypedEmitter. */
export interface RawEventer {
  on(type: string, listener: (data: unknown) => void): void;
  un(type: string, listener: (data: unknown) => void): void;
}

/** An Overlay component (src/controls/legend/overlay.js). */
export interface RawOverlay {
  getLayer(): OlBaseLayer;
}

/** A GroupList/LayerList component (src/controls/legend/grouplist.js). */
export interface RawGroupList {
  getOverlays(): RawOverlay[];
  getGroups(): RawGroup[];
}

/** A Group component (src/controls/legend/group.js). */
export interface RawGroup {
  readonly name: string;
  readonly title: string;
  readonly type: 'group' | 'grouplayer';
  readonly parent?: string;
  getVisible(): 'all' | 'none' | 'mixed';
  getOverlayList(): RawGroupList;
  getEl(): HTMLElement | null;
}

/** The Overlays component (src/controls/legend/overlays.js). */
export interface RawOverlays {
  getGroups(): RawGroup[];
}

/** legend.js's own returned Component. */
export interface RawLegendControl extends RawEventer {
  getOverlays(): RawOverlays;
}

/** Only the viewer surface this adapter needs (add:group/remove:group). */
export interface RawGroupEvent {
  group: { name: string };
}

export interface RawViewerEventSource extends RawEventer {
  on(type: 'add:group' | 'remove:group', listener: (data: RawGroupEvent) => void): void;
  un(type: 'add:group' | 'remove:group', listener: (data: RawGroupEvent) => void): void;
}
