const CLASS_META = new WeakMap();
const TAG_META = new WeakMap();

function ensureClassMeta(ctor) {
  if (!CLASS_META.has(ctor)) {
    CLASS_META.set(ctor, { props: {}, slots: {}, description: "", tag: "", ctor });
  }
  return CLASS_META.get(ctor);
}

function inferTypeFromValue(value, options = {}) {
  if (Array.isArray(options.values) && options.values.length > 0) {
    return { type: "enum", values: [...options.values] };
  }
  if (Array.isArray(value)) {
    return { type: "array", items: typeof value[0] === "string" ? "string" : typeof value[0] };
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

function toKebabCase(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

function isValidCustomElementTag(tag) {
  return /^[a-z][a-z0-9._-]*-[a-z0-9._-]+$/.test(tag);
}

function truncateDescription(text = "") {
  const firstSentence = text.split(".")[0] || text;
  return firstSentence.slice(0, 60).trim();
}

function createOrFallbackElement(tag) {
  const hasCustomElements = typeof globalThis.customElements !== "undefined";
  if (hasCustomElements && globalThis.customElements.get(tag)) {
    return document.createElement(tag);
  }
  const unknown = document.createElement("agent-unknown");
  unknown.dataset.component = tag;
  return unknown;
}

export class ComponentRegistryImpl {
  constructor() {
    this.declarations = new Map();
  }

  register(declaration) {
    this.declarations.set(declaration.tag, declaration);
    if (
      typeof globalThis.customElements !== "undefined" &&
      typeof globalThis.customElements.define === "function" &&
      !globalThis.customElements.get(declaration.tag)
    ) {
      globalThis.customElements.define(declaration.tag, declaration.constructor);
    }
  }

  getAll() {
    return [...this.declarations.values()].map(({ constructor: _c, ...rest }) => ({ ...rest }));
  }

  get(tag) {
    const declaration = this.declarations.get(tag);
    if (!declaration) {
      return undefined;
    }
    const { constructor: _c, ...rest } = declaration;
    return { ...rest };
  }

  getInternal(tag) {
    return this.declarations.get(tag);
  }

  getManifest(options = {}) {
    const budget = options.budget ?? "minimal";
    const declarations = [...this.declarations.values()];
    if (budget === "standard") {
      return declarations
        .map((d) => {
          const props = Object.entries(d.props)
            .map(([name, p]) => {
              const type = p.type === "enum" ? p.values.join("|") : p.type;
              const range = p.type === "number" && (p.min !== undefined || p.max !== undefined)
                ? `, ${p.min ?? "-∞"}–${p.max ?? "∞"}`
                : "";
              return `${name}(${type}${p.required ? ", required" : ""}${range})`;
            })
            .join(", ");
          const slots = Object.keys(d.slots).length > 0
            ? `\n  Slots: ${Object.entries(d.slots).map(([name, s]) => `${name}${s.required ? "!" : ""}${s.description ? `(${s.description})` : ""}`).join(", ")}`
            : "";
          return `${d.tag} — ${d.description}\n  Props: ${props}${slots}`;
        })
        .join("\n\n");
    }
    if (budget === "full") {
      return JSON.stringify(this.getAll(), null, 2);
    }
    return declarations
      .map((d) => {
        const props = Object.entries(d.props)
          .map(([name, p]) => {
            let type = p.type;
            if (p.type === "enum") {
              type = p.values.join("|");
            } else if (p.type === "string") {
              type = "str";
            } else if (p.type === "number") {
              type = "float";
            } else if (p.type === "boolean") {
              type = "bool";
            } else if (p.type === "array") {
              type = "arr";
            }
            return `${name}:${type}${p.required ? "!" : ""}`;
          })
          .join(", ");
        return `${d.tag}(${props}) — ${truncateDescription(d.description)}`;
      })
      .join("\n");
  }
}

export const ComponentRegistry = new ComponentRegistryImpl();

export function tag(name) {
  if (!isValidCustomElementTag(name)) {
    throw new Error(`Invalid custom element tag: ${name}`);
  }
  return function (_target, context) {
    if (context.kind !== "class") {
      throw new Error("@tag can only be used on classes");
    }
    context.addInitializer(function () {
      TAG_META.set(this, name);
      const meta = ensureClassMeta(this);
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
      const ctor = context.kind === "class" ? this : this.constructor;
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
    const isHTMLElementSubclass =
      typeof globalThis.HTMLElement === "undefined" || target.prototype instanceof globalThis.HTMLElement;
    if (!isHTMLElementSubclass) {
      throw new Error("@agent target must extend HTMLElement");
    }
    context.addInitializer(function () {
      const tagName = TAG_META.get(target) ?? toKebabCase(context.name);
      if (!isValidCustomElementTag(tagName)) {
        throw new Error(`Invalid custom element tag: ${tagName}`);
      }
      const meta = ensureClassMeta(target);
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

function parseResponse(text) {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      if (parsed.component) {
        return { type: "ui", nodes: [parsed] };
      }
      if (Array.isArray(parsed.components)) {
        return { type: "ui", nodes: parsed.components };
      }
    }
  } catch (_error) {
  }
  return { type: "text", content: text };
}

function validateNode(node) {
  const errors = [];
  const declaration = ComponentRegistry.getInternal(node.component);
  if (!declaration) {
    errors.push({ prop: "component", message: `Unknown component '${node.component}'`, severity: "error" });
    return { valid: false, errors };
  }

  const props = node.props ?? {};
  for (const [name, propDecl] of Object.entries(declaration.props)) {
    const value = props[name];
    if (propDecl.required && (value === undefined || value === null || value === "")) {
      errors.push({ prop: name, message: "Required prop missing", severity: "error" });
      continue;
    }
    if (value === undefined || value === null) {
      continue;
    }
    if (propDecl.type === "enum" && !propDecl.values.includes(value)) {
      errors.push({
        prop: name,
        message: `Value '${value}' not in enum: ${propDecl.values.join("|")}`,
        severity: "error"
      });
    }
    if (propDecl.type === "number" && typeof value === "number") {
      if (propDecl.min !== undefined && value < propDecl.min) {
        errors.push({ prop: name, message: `Value ${value} below min of ${propDecl.min}`, severity: "error" });
      }
      if (propDecl.max !== undefined && value > propDecl.max) {
        errors.push({ prop: name, message: `Value ${value} exceeds max of ${propDecl.max}`, severity: "error" });
      }
    }
  }

  for (const key of Object.keys(props)) {
    if (!declaration.props[key]) {
      errors.push({ prop: key, message: `Unknown prop '${key}'`, severity: "warning" });
    }
  }

  return { valid: !errors.some((e) => e.severity === "error"), errors };
}

function renderNode(node, parent) {
  const validation = validateNode(node);
  const element = validation.valid ? createOrFallbackElement(node.component) : createOrFallbackElement(node.component);
  if (node.props && validation.valid) {
    for (const [name, value] of Object.entries(node.props)) {
      element[name] = value;
    }
  }

  if (typeof node.children === "string") {
    element.appendChild(document.createTextNode(node.children));
  } else if (Array.isArray(node.children)) {
    for (const child of node.children) {
      renderNode(child, element);
    }
  }

  if (node.slots && typeof node.slots === "object") {
    for (const [slotName, slotValue] of Object.entries(node.slots)) {
      if (typeof slotValue === "string") {
        const text = document.createElement("span");
        if (slotName !== "default") {
          text.slot = slotName;
        }
        text.textContent = slotValue;
        element.appendChild(text);
      } else if (Array.isArray(slotValue)) {
        for (const child of slotValue) {
          const temp = document.createElement("div");
          renderNode(child, temp);
          const slotted = temp.firstChild;
          if (slotted && slotName !== "default") {
            slotted.slot = slotName;
          }
          if (slotted) {
            element.appendChild(slotted);
          }
        }
      }
    }
  }

  parent.appendChild(element);
}

export class AgentRenderer {
  constructor(container) {
    this.container = container;
  }

  render(nodes) {
    for (const node of nodes) {
      renderNode(node, this.container);
    }
  }
}

export const AgentRuntime = {
  parse: parseResponse,
  validate: validateNode,
  buildSystemPrompt(options = {}) {
    const budget = options.budget ?? "minimal";
    const preamble = options.preamble !== false
      ? [
        "You may respond using structured UI components in addition to or instead of plain text.",
        "When a visual component would communicate information more clearly, prefer it.",
        "",
        'Emit components as JSON with this shape:',
        '  { "component": "tag-name", "props": {}, "children": "slot text or nested nodes" }',
        "",
        "For multiple root-level components:",
        '  { "components": [ ...nodes ] }',
        ""
      ].join("\n")
      : "";
    const manifest = ComponentRegistry.getManifest({ budget });
    return `${preamble}Available components:\n${manifest}`.trim();
  }
};
