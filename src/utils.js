export function inferTypeFromValue(value, options = {}) {
  if (Array.isArray(options.values) && options.values.length > 0) {
    return { type: "enum", values: [...options.values] };
  }
  if (Array.isArray(value)) {
    const first = value[0];
    const itemType = first === undefined ? "string" : (typeof first === "string" ? "string" : typeof first);
    return { type: "array", items: itemType };
  }
  if (typeof value === "string") {
    return { type: "string" };
  }
  if (typeof value === "number") {
    return { type: "number" };
  }
  if (typeof value === "boolean") {
    return { type: "boolean" };
  }
  return { type: "string" };
}

export function toKebabCase(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

export function isValidCustomElementTag(tag) {
  if (typeof tag !== "string" || tag.length < 2) {
    return false;
  }
  if (!tag.includes("-")) {
    return false;
  }
  const validChar = (char) =>
    (char >= "a" && char <= "z") ||
    (char >= "0" && char <= "9") ||
    char === "." ||
    char === "_" ||
    char === "-";
  if (!(tag[0] >= "a" && tag[0] <= "z")) {
    return false;
  }
  let hasNonDashAfter = false;
  for (let i = 0; i < tag.length; i += 1) {
    const char = tag[i];
    if (!validChar(char)) {
      return false;
    }
    if (char !== "-" && i > tag.indexOf("-")) {
      hasNonDashAfter = true;
    }
  }
  return hasNonDashAfter;
}

export function truncateDescription(text = "") {
  const match = String(text).match(/(.+?[.!?])(\s|$)/);
  const firstSentence = match ? match[1] : text;
  return firstSentence.slice(0, 60).trim();
}

export function createOrFallbackElement(tag) {
  const hasCustomElements = typeof globalThis.customElements !== "undefined";
  if (hasCustomElements && globalThis.customElements.get(tag)) {
    return document.createElement(tag);
  }
  const unknown = document.createElement("agent-unknown");
  unknown.dataset.component = tag;
  return unknown;
}
