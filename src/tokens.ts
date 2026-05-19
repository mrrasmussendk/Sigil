/**
 * Design Tokens Community Group (DTCG) loader.
 *
 * Accepts a DTCG-shaped JSON tree, flattens it to a dot-path map, resolves
 * `{alias}` references, and exposes the result to the runtime (for validation)
 * and the renderer (for CSS custom-property emission).
 */

/** A leaf token in a DTCG file — anything with `$value` set. */
export interface DesignTokenLeaf {
  readonly $value: unknown;
  readonly $type?: string;
  readonly $description?: string;
}

/** Recursive DTCG group. Leaves have `$value`; nested groups don't. */
export interface DesignTokenFile {
  readonly [key: string]: DesignTokenFile | DesignTokenLeaf | string | undefined;
}

/** Flattened, alias-resolved token entry. */
export interface TokenEntry {
  readonly path: string;
  readonly type: string;
  readonly value: unknown;
  readonly raw: unknown;
  readonly description?: string;
}

const ALIAS_RE = /^\{([^}]+)\}$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isLeaf(node: unknown): node is DesignTokenLeaf {
  return isObject(node) && "$value" in node;
}

interface CollectedLeaf {
  readonly leaf: DesignTokenLeaf;
  readonly inheritedType: string | undefined;
}

function collect(
  input: unknown,
  path: string[],
  inheritedType: string | undefined,
  out: Map<string, CollectedLeaf>
): void {
  if (!isObject(input)) return;
  const groupType = typeof input.$type === "string" ? input.$type : inheritedType;
  for (const [key, child] of Object.entries(input)) {
    if (key.startsWith("$")) continue;
    const next = [...path, key];
    if (isLeaf(child)) {
      out.set(next.join("."), { leaf: child, inheritedType: groupType });
    } else if (isObject(child)) {
      collect(child, next, groupType, out);
    }
  }
}

function resolveAliases(
  raw: unknown,
  entries: Map<string, CollectedLeaf>,
  seen: Set<string>
): unknown {
  if (typeof raw !== "string") return raw;
  const match = raw.match(ALIAS_RE);
  if (!match) return raw;
  const target = match[1]!;
  if (seen.has(target)) {
    throw new Error(`Circular token alias: ${target}`);
  }
  const entry = entries.get(target);
  if (!entry) return raw;
  const nextSeen = new Set(seen);
  nextSeen.add(target);
  return resolveAliases(entry.leaf.$value, entries, nextSeen);
}

function cssVarName(path: string): string {
  return `--${path.replace(/\./g, "-")}`;
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}

const TOKEN_PATH_RE = /^[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]+)+$/;

/** Heuristic: a value the agent likely meant as a dot-path token reference. */
export function looksLikeTokenPath(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATH_RE.test(value);
}

const TOKEN_STYLE_ATTR = "data-sigil-tokens";

export class DesignTokensImpl {
  #entries: Map<string, TokenEntry> = new Map();

  load(file: DesignTokenFile): void {
    const leaves = new Map<string, CollectedLeaf>();
    collect(file, [], undefined, leaves);
    const next = new Map<string, TokenEntry>();
    for (const [path, { leaf, inheritedType }] of leaves) {
      const type = leaf.$type ?? inheritedType ?? "unknown";
      const description = typeof leaf.$description === "string" ? leaf.$description : undefined;
      const entry: TokenEntry = {
        path,
        type,
        raw: leaf.$value,
        value: resolveAliases(leaf.$value, leaves, new Set()),
        ...(description !== undefined ? { description } : {})
      };
      next.set(path, entry);
    }
    this.#entries = next;
  }

  clear(): void {
    this.#entries = new Map();
  }

  get size(): number {
    return this.#entries.size;
  }

  resolve(path: string): TokenEntry | undefined {
    return this.#entries.get(path);
  }

  list(filter: { type?: string } = {}): readonly TokenEntry[] {
    const all = Array.from(this.#entries.values());
    return filter.type ? all.filter((t) => t.type === filter.type) : all;
  }

  cssVarRef(path: string): string {
    return `var(${cssVarName(path)})`;
  }

  /** Emit a CSS rule of custom-property declarations for the loaded set. */
  toCss(options: { selector?: string } = {}): string {
    if (this.#entries.size === 0) return "";
    const selector = options.selector ?? ":root";
    const decls = Array.from(this.#entries.values())
      .map((e) => `  ${cssVarName(e.path)}: ${stringifyValue(e.value)};`)
      .join("\n");
    return `${selector} {\n${decls}\n}`;
  }

  /**
   * Idempotently mount a `<style>` element containing the token CSS into a
   * target (defaults to `document.head`). Re-mounting updates the existing
   * block in place so theme swaps stay live without duplicate nodes.
   */
  mountStyles(options: { target?: ParentNode & Node; selector?: string; id?: string } = {}): HTMLStyleElement | null {
    if (typeof document === "undefined") return null;
    const target = options.target ?? document.head;
    const id = options.id ?? "default";
    const selector = `style[${TOKEN_STYLE_ATTR}="${id}"]`;
    const css = this.toCss({ selector: options.selector ?? ":root" });
    let style = target.querySelector(selector) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.setAttribute(TOKEN_STYLE_ATTR, id);
      target.appendChild(style);
    }
    style.textContent = css;
    return style;
  }

  /** Human-readable summary for inclusion in the agent system prompt. */
  describe(detail: "compact" | "verbose" = "compact"): string {
    if (this.#entries.size === 0) return "";
    const byType = new Map<string, TokenEntry[]>();
    for (const e of this.#entries.values()) {
      const bucket = byType.get(e.type);
      if (bucket) bucket.push(e);
      else byType.set(e.type, [e]);
    }
    const lines: string[] = [];
    for (const [type, entries] of byType) {
      if (detail === "compact") {
        lines.push(`${type}: ${entries.map((e) => e.path).join(", ")}`);
      } else {
        lines.push(`${type}:`);
        for (const e of entries) {
          const suffix = e.description ? ` — ${e.description}` : "";
          lines.push(`  ${e.path} = ${stringifyValue(e.value)}${suffix}`);
        }
      }
    }
    return lines.join("\n");
  }
}

export const DesignTokens: DesignTokensImpl = new DesignTokensImpl();
