import type { Layer } from './layer/layer';

/**
 * State + events. DOM rendering is a consumer of this interface, not the
 * interface itself, so rendering can later move to Lit without touching
 * the contract.
 *
 * First implementation: an adapter wrapping the current legend component
 * (src/controls/legend.js, no public groups API today) - Phase 4, not
 * implemented here.
 */
export interface LegendGroup {
  readonly name: string;
  readonly title: string;
  readonly expanded: boolean;
  readonly layers: readonly Layer[];
  readonly groups: readonly LegendGroup[]; // nested groups
}

export type LegendEventMap = {
  'group:expand': { group: LegendGroup };
  'group:collapse': { group: LegendGroup };
  'layer:toggle': { layer: Layer; visible: boolean };
  render: Record<string, never>;
};

export interface Legend {
  getGroups(): readonly LegendGroup[];
  getGroup(name: string): LegendGroup | undefined;
  expandGroup(name: string): void;
  collapseGroup(name: string): void;
  expandAll(): void;
  collapseAll(): void;
  on<K extends keyof LegendEventMap & string>(
    ev: K,
    fn: (e: LegendEventMap[K]) => void
  ): () => void;
}
