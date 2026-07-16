// jsdom doesn't implement ResizeObserver (a real browser API OL's Map uses
// to detect target element size changes) - stub it so OL Map construction
// doesn't throw under jsdom. OL's own usage (ol/Map.js) ignores the
// callback's entries argument entirely - it just calls updateSize() on any
// resize - so invoking the callback once synchronously on observe() (real
// browsers report the initial size immediately too) is enough to give the
// map a real (if zero, since jsdom has no layout engine) size instead of
// leaving map.getSize() permanently undefined. Not an application concern,
// purely a test environment gap.
// jsdom's getComputedStyle() returns the unresolved keyword 'medium' for
// border-width on any element without an explicit border style set (real
// browsers resolve this to '0px' when there's no border-style) - OL's
// Map.updateSize() does parseFloat(computedStyle.borderLeftWidth) etc.
// unconditionally, and parseFloat('medium') is NaN, poisoning its size
// calculation into `undefined` forever. Reset globally since the map's
// actual target div is created dynamically (by Viewer's own render()) so
// there's no fixed element to style ahead of time.
const style = document.createElement('style');
style.textContent = '* { border-width: 0; padding: 0; }';
document.head.appendChild(style);

class ResizeObserverStub {
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(): void {
    this.callback([], this as unknown as ResizeObserver);
  }

  unobserve(): void {}

  disconnect(): void {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
