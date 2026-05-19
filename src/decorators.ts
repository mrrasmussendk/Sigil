import "./polyfills.js";
import { ComponentRegistry } from "./registry.js";
import {
  DecoratorMetadata,
  ensureClassMeta,
  getTagMeta,
  metaPropsFor,
  metaSlotsFor,
  setTagMeta
} from "./state.js";
import {
  buildPropDecl,
  inferPropShape,
  isValidCustomElementTag,
  toKebabCase
} from "./utils.js";
import type { PropOptions, SlotOptions } from "./types.js";

type AnyClass = abstract new (...args: never[]) => object;

function readMetadata(context: { metadata?: object | null }): DecoratorMetadata {
  // Stage 3 metadata: `context.metadata` is non-null when the runtime polyfill
  // is in place (we do so in ./polyfills.ts). Treat as an open dictionary.
  return (context.metadata ?? {}) as DecoratorMetadata;
}

/** Declare the custom element tag for a class. */
export function tag(name: string) {
  if (!isValidCustomElementTag(name)) {
    throw new Error(`Invalid custom element tag: ${name}`);
  }
  return function tagDecorator(target: AnyClass, context: ClassDecoratorContext): void {
    if (context.kind !== "class") {
      throw new Error("@tag can only be used on classes");
    }
    context.addInitializer(function tagInit(this: unknown): void {
      setTagMeta(target, name);
      const meta = ensureClassMeta(target);
      meta.tag = name;
    });
  };
}

type FieldOrAccessorContext = ClassFieldDecoratorContext | ClassAccessorDecoratorContext;

/** Describe a prop on a field or accessor. */
export function prop(description: string, options: PropOptions = {}) {
  return function propDecorator(_value: unknown, context: FieldOrAccessorContext): void {
    if (context.kind !== "field" && context.kind !== "accessor") {
      throw new Error("@prop can only be used on fields/accessors");
    }
    const propName = String(context.name);

    // Class-time registration via decorator metadata. This lets @agent register
    // the full prop catalogue before any instance is constructed.
    const hasExplicitShape =
      options.type !== undefined || (Array.isArray(options.values) && options.values.length > 0);
    if (hasExplicitShape) {
      const shape = inferPropShape(undefined, options);
      const bag = metaPropsFor(readMetadata(context));
      bag[propName] = buildPropDecl(description, options, shape);
    }

    // Per-instance fallback. If no explicit type was given, infer from the
    // initial runtime value when the first instance is constructed. Either
    // way, keep the registered declaration in sync so the manifest reflects
    // any later edits.
    context.addInitializer(function propInit(this: unknown): void {
      const instance = this as { constructor: AnyClass } & Record<string, unknown>;
      const ctor = instance.constructor;
      const meta = ensureClassMeta(ctor);
      const currentValue = instance[propName];
      const shape = inferPropShape(currentValue, options);
      meta.props[propName] = buildPropDecl(description, options, shape);
      const declaration = ComponentRegistry.getInternal(meta.tag);
      if (declaration) {
        (declaration.props as Record<string, unknown>)[propName] = meta.props[propName]!;
      }
    });
  };
}

function slotNameFromFieldName(name: string): string {
  if (name === "default" || name === "defaultSlot") return "default";
  return name.endsWith("Slot") ? toKebabCase(name.slice(0, -4)) : toKebabCase(name);
}

type SlotContext = FieldOrAccessorContext | ClassMethodDecoratorContext;

/** Describe a slot on a field, accessor or method. */
export function slot(description: string, options: SlotOptions = {}) {
  return function slotDecorator(_value: unknown, context: SlotContext): void {
    if (context.kind !== "field" && context.kind !== "accessor" && context.kind !== "method") {
      throw new Error("@slot can only be used on fields, accessors or methods");
    }
    const name = slotNameFromFieldName(String(context.name));
    const required = options.required ?? false;

    // Class-time registration
    const bag = metaSlotsFor(readMetadata(context));
    bag[name] = { description, required };

    context.addInitializer(function slotInit(this: unknown): void {
      const instance = this as { constructor: AnyClass };
      const ctor = instance.constructor;
      const meta = ensureClassMeta(ctor);
      meta.slots[name] = { description, required };
      const declaration = ComponentRegistry.getInternal(meta.tag);
      if (declaration) {
        (declaration.slots as Record<string, unknown>)[name] = meta.slots[name]!;
      }
    });
  };
}

/**
 * Register a class as an agent-renderable component. Must be applied on top
 * of `@tag` (or rely on auto-kebab-casing of the class name) and the class
 * must extend HTMLElement.
 */
export function agent(description: string) {
  if (typeof description !== "string" || description.length === 0) {
    throw new Error("@agent requires a description");
  }
  return function agentDecorator(target: AnyClass, context: ClassDecoratorContext): void {
    if (context.kind !== "class") {
      throw new Error("@agent can only be used on classes");
    }
    if (typeof globalThis.HTMLElement === "undefined") {
      throw new Error("@agent requires HTMLElement to be available");
    }
    const isHTMLElementSubclass = (target as unknown as { prototype: object }).prototype instanceof globalThis.HTMLElement;
    if (!isHTMLElementSubclass) {
      throw new Error("@agent target must extend HTMLElement");
    }

    const metadata = readMetadata(context);
    const metaProps = metaPropsFor(metadata);
    const metaSlots = metaSlotsFor(metadata);

    context.addInitializer(function agentInit(this: unknown): void {
      const meta = ensureClassMeta(target);
      const tagName = getTagMeta(target) ?? meta.tag ?? toKebabCase(String(context.name));
      if (!isValidCustomElementTag(tagName)) {
        throw new Error(`Invalid custom element tag: ${tagName}`);
      }
      // Hoist anything collected at class-decoration time into the shared
      // mutable bag the registry will hand out.
      for (const [name, decl] of Object.entries(metaProps)) {
        if (!meta.props[name]) meta.props[name] = decl;
      }
      for (const [name, decl] of Object.entries(metaSlots)) {
        if (!meta.slots[name]) meta.slots[name] = decl;
      }
      meta.description = description;
      meta.tag = tagName;
      meta.ctor = target as unknown as CustomElementConstructor;
      ComponentRegistry.register({
        tag: tagName,
        description,
        props: meta.props,
        slots: meta.slots,
        constructor: target as unknown as CustomElementConstructor
      });
    });
  };
}
