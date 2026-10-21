// jsdom has no 2D canvas and logs "Not implemented" on every call; the engine
// keeps its state without one. Node suites have no canvas to patch.
if (typeof HTMLCanvasElement !== "undefined") {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: () => null,
    writable: true,
  });
}
