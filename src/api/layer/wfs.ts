import type OlVectorLayer from 'ol/layer/Vector';
import type VectorSource from 'ol/source/Vector';
import { Layer } from './layer';

/**
 * Wraps WFS layers produced by src/layer/wfs.js. Vector-backed under the
 * hood (goes through src/layer/vector.js like the 'vector' bucket types),
 * but kept as its own bucket per architecture.md.
 */
export class WfsLayer extends Layer<OlVectorLayer<VectorSource>> {
  get type(): 'wfs' {
    return 'wfs';
  }
}
