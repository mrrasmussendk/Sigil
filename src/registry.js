import { truncateDescription } from "./utils.js";

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
                ? `, ${p.min ?? "-Infinity"}–${p.max ?? "Infinity"}`
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
