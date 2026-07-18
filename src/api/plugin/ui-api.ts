import sidebar from '../../sidebar';
import type { UiApi, UiSlot } from './plugin';
import type { RawViewer } from './raw';

/**
 * Routes into Origo's real, already-existing UI containers - the same
 * ones every built-in control targets (e.g. src/controls/zoom.js:
 * `document.getElementById(viewer.getMain().getNavigation().getId())
 * .appendChild(el)`). No layout system invented; 'sidebar' delegates to
 * src/sidebar.js's singleton panel (shared - last write wins, same
 * constraint the real sidebar already has for everyone).
 *
 * Caveat specific to 'sidebar', not shared by the other four slots:
 * sidebar.js's insertContent() does `el.innerHTML = content` (a string),
 * not appendChild(element) - so registerControl('sidebar', element) only
 * transfers markup, not the live DOM node. Event listeners already
 * attached to `element` via addEventListener do NOT survive; a plugin
 * targeting 'sidebar' must (re)bind behavior after insertion (e.g. via
 * event delegation on a stable ancestor, or by looking its element back
 * up from the DOM by id/class after calling registerControl). The other
 * four slots insert the live element directly and have no such caveat.
 *
 * Second caveat: sidebar.js's #o-sidebar DOM only exists if something has
 * already called sidebar.init(viewer) - normally done by featureinfo.js
 * only when configured with `infowindow: 'sidebar'`. A viewer without that
 * configured has no #o-sidebar element yet, and sidebar.setContent() would
 * throw (querySelector returns null, then `.innerHTML =` on it throws).
 * Initialize it lazily here so registerControl('sidebar', ...) works
 * regardless of featureinfo's own configuration.
 */
export function createUiApi(viewer: RawViewer): UiApi {
  return {
    registerControl(slot: UiSlot, element: HTMLElement): void {
      if (slot === 'sidebar') {
        if (!document.getElementById('o-sidebar')) {
          sidebar.init(viewer);
        }
        sidebar.setContent({ content: element.outerHTML });
        return;
      }

      const main = viewer.getMain();
      const containerId = {
        navigation: main.getNavigation().getId(),
        maptools: main.getMapTools().getId(),
        misctools: main.getMiscTools().getId(),
        bottomtools: main.getBottomTools().getId()
      }[slot];

      document.getElementById(containerId)?.appendChild(element);
    }
  };
}
