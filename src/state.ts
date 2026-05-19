import "./polyfills.js";
import type { PropDecl, SlotDecl } from "./types.js";

/**
 * Per-class declaration buffer. Both the {@link tag} and {@link prop} decorators
 * write into this; {@link agent} reads from it when registering the component.
 */
export interface ClassMeta {
  props: Record<string, PropDecl>;
  slots: Record<string, SlotDecl>;
  description: string;
  tag: string;
  ctor: CustomElementConstructor | null;
}

const CLASS_META = new WeakMap<object, ClassMeta>();
const TAG_META = new WeakMap<object, string>();

export function ensureClassMeta(ctor: object): ClassMeta {
  let meta = CLASS_META.get(ctor);
  if (!meta) {
    meta = { props: {}, slots: {}, description: "", tag: "", ctor: null };
    CLASS_META.set(ctor, meta);
  }
  return meta;
}

export function getClassMeta(ctor: object): ClassMeta | undefined {
  return CLASS_META.get(ctor);
}

export function setTagMeta(ctor: object, tag: string): void {
  TAG_META.set(ctor, tag);
}

export function getTagMeta(ctor: object): string | undefined {
  return TAG_META.get(ctor);
}

/**
 * Decorator-metadata keys. Stage 3 decorators expose a per-class
 * `context.metadata` object; we stash collected prop and slot declarations
 * there so the class decorator can register them at class-definition time
 * without needing an instance.
 */
export const PROP_META_KEY: unique symbol = Symbol("sigil:props");
export const SLOT_META_KEY: unique symbol = Symbol("sigil:slots");

export type DecoratorMetadata = Record<string | symbol, unknown>;

export function metaPropsFor(metadata: DecoratorMetadata): Record<string, PropDecl> {
  let bag = metadata[PROP_META_KEY] as Record<string, PropDecl> | undefined;
  if (!bag) {
    bag = {};
    metadata[PROP_META_KEY] = bag;
  }
  return bag;
}

export function metaSlotsFor(metadata: DecoratorMetadata): Record<string, SlotDecl> {
  let bag = metadata[SLOT_META_KEY] as Record<string, SlotDecl> | undefined;
  if (!bag) {
    bag = {};
    metadata[SLOT_META_KEY] = bag;
  }
  return bag;
}
