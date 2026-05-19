import { truncateDescription } from "./utils.js";
import type {
  ComponentDeclaration,
  ComponentDeclarationPublic,
  ManifestOptions,
  PropDecl
} from "./types.js";

function publicView(d: ComponentDeclaration): ComponentDeclarationPublic {
  return {
    tag: d.tag,
    description: d.description,
    props: { ...d.props },
    slots: { ...d.slots }
  };
}

function shortType(p: PropDecl): string {
  switch (p.type) {
    case "string":
      return "str";
    case "number":
      return "float";
    case "boolean":
      return "bool";
    case "array":
      return "arr";
    case "enum":
      return p.values.join("|");
    case "token":
      return p.group ? `tok<${p.group}>` : "tok";
  }
}

function longType(p: PropDecl): string {
  if (p.type === "enum") return p.values.join("|");
  if (p.type === "token") return p.group ? `token<${p.group}>` : "token";
  return p.type;
}

function rangeSuffix(p: PropDecl): string {
  if (p.type !== "number") return "";
  if (p.min === undefined && p.max === undefined) return "";
  return `, ${p.min ?? "-Infinity"}–${p.max ?? "Infinity"}`;
}

export class ComponentRegistryImpl {
  readonly #declarations: Map<string, ComponentDeclaration> = new Map();

  register(declaration: ComponentDeclaration): void {
    this.#declarations.set(declaration.tag, declaration);
    const ce = globalThis.customElements;
    if (typeof ce !== "undefined" && typeof ce.define === "function" && !ce.get(declaration.tag)) {
      ce.define(declaration.tag, declaration.constructor);
    }
  }

  has(tag: string): boolean {
    return this.#declarations.has(tag);
  }

  get size(): number {
    return this.#declarations.size;
  }

  get(tag: string): ComponentDeclarationPublic | undefined {
    const d = this.#declarations.get(tag);
    return d ? publicView(d) : undefined;
  }

  /** Internal — returns the live (mutable) declaration object, used by decorators. */
  getInternal(tag: string): ComponentDeclaration | undefined {
    return this.#declarations.get(tag);
  }

  getAll(): ComponentDeclarationPublic[] {
    return Array.from(this.#declarations.values(), publicView);
  }

  /** Render the manifest used as the LLM system prompt's component catalog. */
  getManifest(options: ManifestOptions = {}): string {
    const budget = options.budget ?? "minimal";
    const declarations = Array.from(this.#declarations.values());

    if (budget === "full") {
      return JSON.stringify(this.getAll(), null, 2);
    }

    if (budget === "standard") {
      return declarations
        .map((d) => {
          const props = Object.entries(d.props)
            .map(([name, p]) => `${name}(${longType(p)}${p.required ? ", required" : ""}${rangeSuffix(p)})`)
            .join(", ");
          const slots = Object.keys(d.slots).length > 0
            ? `\n  Slots: ${Object.entries(d.slots)
              .map(([name, s]) => `${name}${s.required ? "!" : ""}${s.description ? `(${s.description})` : ""}`)
              .join(", ")}`
            : "";
          return `${d.tag} — ${d.description}\n  Props: ${props}${slots}`;
        })
        .join("\n\n");
    }

    return declarations
      .map((d) => {
        const props = Object.entries(d.props)
          .map(([name, p]) => `${name}:${shortType(p)}${p.required ? "!" : ""}`)
          .join(", ");
        return `${d.tag}(${props}) — ${truncateDescription(d.description)}`;
      })
      .join("\n");
  }
}

export const ComponentRegistry: ComponentRegistryImpl = new ComponentRegistryImpl();
