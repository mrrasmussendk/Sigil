import { ComponentRegistry } from "./registry.js";
import { ensureClassMeta, TAG_META } from "./state.js";
import { inferTypeFromValue, isValidCustomElementTag, toKebabCase } from "./utils.js";

export function tag(name) {
  if (!isValidCustomElementTag(name)) {
    throw new Error(`Invalid custom element tag: ${name}`);
  }
  return function (target, context) {
    if (context.kind !== "class") {
      throw new Error("@tag can only be used on classes");
    }
    context.addInitializer(function () {
      TAG_META.set(target, name);
      const meta = ensureClassMeta(target);
      meta.tag = name;
    });
  };
}

export function prop(description, options = {}) {
  return function (_value, context) {
    if (context.kind !== "field" && context.kind !== "accessor") {
      throw new Error("@prop can only be used on fields/accessors");
    }
    const propName = String(context.name);
    context.addInitializer(function () {
      const ctor = this.constructor;
      const meta = ensureClassMeta(ctor);
      const currentValue = this[propName];
      const inferred = inferTypeFromValue(currentValue, options);
      const previous = meta.props[propName] ?? {};
      meta.props[propName] = {
        ...previous,
        ...inferred,
        description,
        required: options.required ?? previous.required,
        min: options.min ?? previous.min,
        max: options.max ?? previous.max
      };
      const declaration = ComponentRegistry.getInternal(meta.tag);
      if (declaration) {
        declaration.props[propName] = meta.props[propName];
      }
    });
  };
}

function slotNameFromFieldName(name) {
  if (name === "default" || name === "defaultSlot") {
    return "default";
  }
  return name.endsWith("Slot") ? toKebabCase(name.slice(0, -4)) : toKebabCase(name);
}

export function slot(description, options = {}) {
  return function (_value, context) {
    if (context.kind !== "field" && context.kind !== "accessor" && context.kind !== "method") {
      throw new Error("@slot can only be used on fields, accessors or methods");
    }
    const name = slotNameFromFieldName(String(context.name));
    context.addInitializer(function () {
      const ctor = this.constructor;
      const meta = ensureClassMeta(ctor);
      meta.slots[name] = { description, required: options.required ?? false };
      const declaration = ComponentRegistry.getInternal(meta.tag);
      if (declaration) {
        declaration.slots[name] = meta.slots[name];
      }
    });
  };
}

export function agent(description) {
  if (typeof description !== "string" || description.length === 0) {
    throw new Error("@agent requires a description");
  }
  return function (target, context) {
    if (context.kind !== "class") {
      throw new Error("@agent can only be used on classes");
    }
    if (typeof globalThis.HTMLElement === "undefined") {
      throw new Error("@agent requires HTMLElement to be available");
    }
    const isHTMLElementSubclass = target.prototype instanceof globalThis.HTMLElement;
    if (!isHTMLElementSubclass) {
      throw new Error("@agent target must extend HTMLElement");
    }
    context.addInitializer(function () {
      const existingMeta = ensureClassMeta(target);
      const tagName = TAG_META.get(target) ?? existingMeta.tag ?? toKebabCase(context.name);
      if (!isValidCustomElementTag(tagName)) {
        throw new Error(`Invalid custom element tag: ${tagName}`);
      }
      const meta = existingMeta;
      meta.description = description;
      meta.tag = tagName;
      meta.ctor = target;
      const declaration = {
        tag: tagName,
        description,
        props: meta.props,
        slots: meta.slots,
        constructor: target
      };
      ComponentRegistry.register(declaration);
    });
  };
}
