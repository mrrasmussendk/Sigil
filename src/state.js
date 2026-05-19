export const CLASS_META = new WeakMap();
export const TAG_META = new WeakMap();

export function ensureClassMeta(ctor) {
  if (!CLASS_META.has(ctor)) {
    CLASS_META.set(ctor, { props: {}, slots: {}, description: "", tag: "", ctor });
  }
  return CLASS_META.get(ctor);
}
