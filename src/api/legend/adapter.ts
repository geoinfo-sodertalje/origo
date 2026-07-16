import type OlBaseLayer from 'ol/layer/Base';
import { TypedEmitter } from '../typed-emitter';
import { wrapLayer } from '../layer/factory';
import type { Layer } from '../layer/layer';
import type { Legend, LegendGroup, LegendEventMap } from './legend';
import type {
  RawLegendControl, RawViewerEventSource, RawGroup
} from './raw';

/**
 * Wraps the real legend control (src/controls/legend.js + legend/*.js) -
 * no changes to those files. See docs/architecture.md's Legend section for
 * the reachable-surface writeup this implementation is built from.
 */
export class LegendAdapter implements Legend {
  private legendControl: RawLegendControl;

  private emitter = new TypedEmitter<LegendEventMap>();

  private layerCache = new Map<OlBaseLayer, Layer>();

  /** Keyed by group name, not the RawGroup reference - see remove:group handling below. */
  private groupObservers = new Map<string, MutationObserver>();

  constructor(legendControl: RawLegendControl, viewer: RawViewerEventSource) {
    this.legendControl = legendControl;

    // Bridge the old Eventer's 'render' dispatch to the new TypedEmitter.
    legendControl.on('render', () => this.emitter.emit('render', {}));

    this.allGroups().forEach((group) => this.observeGroup(group));

    // Overlays.onInit registers its own add:group/remove:group listener at
    // legend-construction time, earlier than this adapter can exist, so by
    // the time these fire, overlaysCmp.getGroups() already reflects the
    // change (see docs/architecture.md for the ordering argument).
    viewer.on('add:group', (evt) => {
      const group = this.allGroups().find((g) => g.name === evt.group.name);
      if (group) this.observeGroup(group);
    });
    viewer.on('remove:group', (evt) => {
      this.groupObservers.get(evt.group.name)?.disconnect();
      this.groupObservers.delete(evt.group.name);
    });
  }

  private allGroups(): RawGroup[] {
    return this.legendControl.getOverlays().getGroups();
  }

  private rootGroups(): RawGroup[] {
    return this.allGroups().filter((group) => group.type === 'group' || !group.parent);
  }

  /** No forced-expand event exists (see collapse.js) - MutationObserver catches every
   *  transition regardless of trigger path, including the tick:all/untick:all direct
   *  function-call path that bypasses dispatched CustomEvents entirely. */
  private observeGroup(group: RawGroup): void {
    const el = group.getEl();
    if (!el) return;
    this.groupObservers.get(group.name)?.disconnect();
    const observer = new MutationObserver(() => {
      const expanded = el.classList.contains('expanded');
      this.emitter.emit(expanded ? 'group:expand' : 'group:collapse', {
        group: this.buildLegendGroup(group)
      });
    });
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    this.groupObservers.set(group.name, observer);
  }

  private wrapLayerCached(olLayer: OlBaseLayer): Layer | undefined {
    let wrapped = this.layerCache.get(olLayer);
    if (!wrapped) {
      wrapped = wrapLayer(olLayer);
      if (wrapped) {
        this.layerCache.set(olLayer, wrapped);
        const cachedLayer = wrapped;
        // The legend's own checkbox (overlay.js) calls setVisible() on the raw
        // OL layer directly, never through a Layer wrapper - Layer's own
        // emitter would never fire from legend-UI interaction, so this
        // listens to OL's native property-change event instead.
        olLayer.on('change:visible', () => {
          this.emitter.emit('layer:toggle', { layer: cachedLayer, visible: olLayer.getVisible() });
        });
      }
    }
    return wrapped;
  }

  private buildLegendGroup(group: RawGroup): LegendGroup {
    const overlayList = group.getOverlayList();
    return {
      name: group.name,
      title: group.title,
      expanded: group.getEl()?.classList.contains('expanded') ?? false,
      layers: overlayList.getOverlays()
        .map((overlay) => this.wrapLayerCached(overlay.getLayer()))
        .filter((layer): layer is Layer => layer !== undefined),
      groups: overlayList.getGroups().map((child) => this.buildLegendGroup(child))
    };
  }

  getGroups(): readonly LegendGroup[] {
    return this.rootGroups().map((group) => this.buildLegendGroup(group));
  }

  getGroup(name: string): LegendGroup | undefined {
    const group = this.allGroups().find((g) => g.name === name);
    return group ? this.buildLegendGroup(group) : undefined;
  }

  expandGroup(name: string): void {
    const el = this.allGroups().find((g) => g.name === name)?.getEl();
    if (!el || el.classList.contains('expanded')) return;
    el.dispatchEvent(new CustomEvent('collapse:toggle', { bubbles: true, cancelable: true }));
  }

  collapseGroup(name: string): void {
    const el = this.allGroups().find((g) => g.name === name)?.getEl();
    el?.dispatchEvent(new CustomEvent('collapse:collapse', { bubbles: true, cancelable: true }));
  }

  expandAll(): void {
    this.allGroups().forEach((group) => this.expandGroup(group.name));
  }

  collapseAll(): void {
    this.allGroups().forEach((group) => this.collapseGroup(group.name));
  }

  on<K extends keyof LegendEventMap & string>(
    ev: K,
    fn: (e: LegendEventMap[K]) => void
  ): () => void {
    return this.emitter.on(ev, (e) => fn(e.detail));
  }
}
