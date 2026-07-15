/**
 * Typed wrapper around the platform's native EventTarget/CustomEvent - no
 * library dependency, no separate Map-based pub/sub. Same idiom as the DOM
 * CustomEvents used at Lit component boundaries, just usable on plain
 * classes too (EventTarget doesn't require a DOM element).
 *
 * Does not replace src/ui/utils/eventer.js (on/un/dispatch, no unsubscribe
 * return), which every existing UI component already uses via
 * src/ui/component.js. Existing components keep using Eventer unmodified.
 */
export class TypedEmitter<TMap extends Record<string, unknown>> extends EventTarget {
  on<K extends keyof TMap & string>(
    ev: K,
    fn: (e: CustomEvent<TMap[K]>) => void
  ): () => void {
    const listener = fn as EventListener;
    this.addEventListener(ev, listener);
    return () => this.removeEventListener(ev, listener);
  }

  emit<K extends keyof TMap & string>(ev: K, payload: TMap[K]): void {
    this.dispatchEvent(new CustomEvent(ev, { detail: payload }));
  }
}
