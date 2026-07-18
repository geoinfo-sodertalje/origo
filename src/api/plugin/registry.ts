import { createOrigoApi } from './factory';
import type { OrigoApi, OrigoPlugin } from './plugin';
import type { RawViewer } from './raw';

/**
 * Implements origo.use(plugin) with a real init/destroy lifecycle.
 * Plugin lifecycle is viewer-scoped: origo.js can rebuild the viewer
 * entirely (a sharemap hash change re-runs initViewer() and re-dispatches
 * origo's 'load' event with a new viewer instance) - on every such change,
 * every registered plugin's destroy() (if present) is called against the
 * outgoing viewer, then init() is called again with a fresh OrigoApi for
 * the incoming one. A plugin registered via use() after 'load' has already
 * fired once gets init() called immediately against the current viewer,
 * rather than left stranded until a reboot that may never come.
 */
export class PluginRegistry {
  private plugins: OrigoPlugin[] = [];

  private activeApi: OrigoApi | null = null;

  use(plugin: OrigoPlugin): void {
    this.plugins.push(plugin);
    if (this.activeApi) {
      plugin.init(this.activeApi);
    }
  }

  onViewerChange(viewer: RawViewer): void {
    // Only tear down if there was a previous viewer - the first call has
    // nothing to destroy yet, every plugin here is still pre-init.
    if (this.activeApi) {
      this.plugins.forEach((plugin) => {
        try {
          plugin.destroy?.();
        } catch (error) {
          console.error(`PluginRegistry: "${plugin.name}".destroy() threw`, error);
        }
      });
    }
    this.activeApi = createOrigoApi(viewer);
    this.plugins.forEach((plugin) => plugin.init(this.activeApi!));
  }
}
