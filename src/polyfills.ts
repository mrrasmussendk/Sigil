// Stage 3 decorator metadata requires Symbol.metadata at runtime.
// Node and most browsers don't provide it yet (TC39 stage 3),
// so we attach a shared well-known symbol once at module load.
type SymbolWithMetadata = SymbolConstructor & { metadata: symbol };
const S = Symbol as SymbolWithMetadata;
if (!S.metadata) {
  Object.defineProperty(S, "metadata", {
    value: Symbol.for("Symbol.metadata"),
    writable: false,
    configurable: false,
    enumerable: false
  });
}

export {};
