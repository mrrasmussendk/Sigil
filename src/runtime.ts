import { ComponentRegistry } from "./registry.js";
import { DesignTokens, looksLikeTokenPath } from "./tokens.js";
import type {
  ParseResult,
  SystemPromptOptions,
  UINode,
  ValidationError,
  ValidationResult
} from "./types.js";

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

export function parseResponse(text: string): ParseResult {
  try {
    const parsed: unknown = JSON.parse(text);
    if (isObject(parsed)) {
      if (typeof parsed.component === "string") {
        return { type: "ui", nodes: [parsed as unknown as UINode] };
      }
      if (Array.isArray(parsed.components)) {
        return { type: "ui", nodes: parsed.components as UINode[] };
      }
    }
  } catch {
    // not JSON — fall through to text result
  }
  return { type: "text", content: text };
}

export function validateNode(node: UINode): ValidationResult {
  const errors: ValidationError[] = [];
  const declaration = ComponentRegistry.getInternal(node.component);

  if (!declaration) {
    errors.push({
      prop: "component",
      message: `Unknown component '${node.component}'`,
      severity: "error"
    });
    return { valid: false, errors };
  }

  const props: Record<string, unknown> = node.props ?? {};

  for (const [name, propDecl] of Object.entries(declaration.props)) {
    const value = props[name];
    const isMissing = value === undefined || value === null || (propDecl.type === "string" && value === "");

    if (propDecl.required && isMissing) {
      errors.push({ prop: name, message: "Required prop missing", severity: "error" });
      continue;
    }
    if (value === undefined || value === null) continue;

    if (propDecl.type === "enum" && !propDecl.values.includes(value as string)) {
      errors.push({
        prop: name,
        message: `Value '${String(value)}' not in enum: ${propDecl.values.join("|")}`,
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
    if (propDecl.type === "token") {
      if (typeof value !== "string") {
        errors.push({ prop: name, message: "Token reference must be a string", severity: "error" });
      } else if (DesignTokens.size > 0 && looksLikeTokenPath(value)) {
        const entry = DesignTokens.resolve(value);
        if (!entry) {
          errors.push({ prop: name, message: `Unknown design token '${value}'`, severity: "error" });
        } else if (propDecl.group && entry.type !== propDecl.group) {
          errors.push({
            prop: name,
            message: `Token '${value}' has $type '${entry.type}', expected '${propDecl.group}'`,
            severity: "error"
          });
        }
      }
    }
  }

  for (const key of Object.keys(props)) {
    if (!(key in declaration.props)) {
      errors.push({ prop: key, message: `Unknown prop '${key}'`, severity: "warning" });
    }
  }

  return { valid: !errors.some((e) => e.severity === "error"), errors };
}

const PREAMBLE = [
  "You may respond using structured UI components in addition to or instead of plain text.",
  "When a visual component would communicate information more clearly, prefer it.",
  "",
  "Emit components as JSON with this shape:",
  '  { "component": "tag-name", "props": {}, "children": "slot text or nested nodes" }',
  "",
  "For multiple root-level components:",
  '  { "components": [ ...nodes ] }',
  ""
].join("\n");

export const Sigil = {
  parse: parseResponse,
  validate: validateNode,
  buildSystemPrompt(options: SystemPromptOptions = {}): string {
    const budget = options.budget ?? "minimal";
    const preamble = options.preamble === false ? "" : PREAMBLE;
    const manifest = ComponentRegistry.getManifest({ budget });
    const tokenSection = DesignTokens.size > 0
      ? `\n\nAvailable design tokens (reference by dot-path):\n${DesignTokens.describe(budget === "minimal" ? "compact" : "verbose")}`
      : "";
    return `${preamble}Available components:\n${manifest}${tokenSection}`.trim();
  }
} as const;

export type SigilType = typeof Sigil;
