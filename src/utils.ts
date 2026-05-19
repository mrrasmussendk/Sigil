import type { PropDecl, PropOptions, PropType } from "./types.js";

/** Result of inferring/resolving a prop type from options + initial value. */
export type InferredPropShape =
  | { type: "string" }
  | { type: "number"; min?: number; max?: number }
  | { type: "boolean" }
  | { type: "array"; items: string }
  | { type: "enum"; values: readonly string[] }
  | { type: "token"; group?: string };

/**
 * Resolve a prop's structural shape from explicit options and an optional
 * initial value. Explicit `options.type` (and `values`/`items`) win;
 * runtime inference is used as a fallback.
 */
export function inferPropShape(value: unknown, options: PropOptions = {}): InferredPropShape {
  if (options.type === "enum" || (options.values && options.values.length > 0)) {
    return { type: "enum", values: [...(options.values ?? [])] };
  }
  if (options.type === "token") {
    return options.group !== undefined ? { type: "token", group: options.group } : { type: "token" };
  }
  if (options.type === "array" || Array.isArray(value)) {
    const explicit = options.items;
    const first = Array.isArray(value) ? value[0] : undefined;
    const items = explicit ?? (first === undefined ? "string" : typeof first);
    return { type: "array", items };
  }
  if (options.type === "number") return { type: "number", min: options.min, max: options.max };
  if (options.type === "string") return { type: "string" };
  if (options.type === "boolean") return { type: "boolean" };
  if (typeof value === "string") return { type: "string" };
  if (typeof value === "number") return { type: "number", min: options.min, max: options.max };
  if (typeof value === "boolean") return { type: "boolean" };
  return { type: "string" };
}

/** Compose a complete {@link PropDecl} from a description, options and a resolved shape. */
export function buildPropDecl(
  description: string,
  options: PropOptions,
  shape: InferredPropShape
): PropDecl {
  const required = options.required ?? false;
  switch (shape.type) {
    case "string":
      return { type: "string", description, required };
    case "boolean":
      return { type: "boolean", description, required };
    case "number":
      return {
        type: "number",
        description,
        required,
        ...(options.min !== undefined ? { min: options.min } : shape.min !== undefined ? { min: shape.min } : {}),
        ...(options.max !== undefined ? { max: options.max } : shape.max !== undefined ? { max: shape.max } : {})
      };
    case "array":
      return { type: "array", description, required, items: shape.items };
    case "enum":
      return { type: "enum", description, required, values: shape.values };
    case "token":
      return shape.group !== undefined
        ? { type: "token", description, required, group: shape.group }
        : { type: "token", description, required };
  }
}

export function toKebabCase(value: unknown): string {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

export function isValidCustomElementTag(tag: unknown): tag is string {
  if (typeof tag !== "string" || tag.length < 2) return false;
  if (!tag.includes("-")) return false;
  const first = tag[0]!;
  if (!(first >= "a" && first <= "z")) return false;
  const validChar = (c: string): boolean =>
    (c >= "a" && c <= "z") ||
    (c >= "0" && c <= "9") ||
    c === "." ||
    c === "_" ||
    c === "-";
  let hasNonDashAfter = false;
  const firstDash = tag.indexOf("-");
  for (let i = 0; i < tag.length; i += 1) {
    const c = tag[i]!;
    if (!validChar(c)) return false;
    if (c !== "-" && i > firstDash) hasNonDashAfter = true;
  }
  return hasNonDashAfter;
}

export function truncateDescription(text: string = ""): string {
  const match = String(text).match(/(.+?[.!?])(\s|$)/);
  const firstSentence = match ? match[1]! : text;
  return firstSentence.slice(0, 60).trim();
}

/** Avoids polluting prop types with extra unions; centralises a `PropType` check. */
export function isPropType(value: unknown): value is PropType {
  return (
    value === "string" ||
    value === "number" ||
    value === "boolean" ||
    value === "array" ||
    value === "enum" ||
    value === "token"
  );
}

export function createOrFallbackElement(tag: string): HTMLElement {
  if (typeof globalThis.customElements !== "undefined" && globalThis.customElements.get(tag)) {
    return document.createElement(tag);
  }
  const unknown = document.createElement("sigil-unknown") as HTMLElement;
  unknown.dataset.component = tag;
  return unknown;
}
