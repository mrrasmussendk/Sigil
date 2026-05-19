import { ComponentRegistry } from "./registry.js";

export function parseResponse(text) {
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
    // Intentionally ignored: non-JSON output should be treated as plain text.
  }
  return { type: "text", content: text };
}

export function validateNode(node) {
  const errors = [];
  const declaration = ComponentRegistry.getInternal(node.component);
  if (!declaration) {
    errors.push({ prop: "component", message: `Unknown component '${node.component}'`, severity: "error" });
    return { valid: false, errors };
  }

  const props = node.props ?? {};
  for (const [name, propDecl] of Object.entries(declaration.props)) {
    const value = props[name];
    const isMissing = value === undefined || value === null || (propDecl.type === "string" && value === "");
    if (propDecl.required && isMissing) {
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
        "Emit components as JSON with this shape:",
        "  { \"component\": \"tag-name\", \"props\": {}, \"children\": \"slot text or nested nodes\" }",
        "",
        "For multiple root-level components:",
        "  { \"components\": [ ...nodes ] }",
        ""
      ].join("\n")
      : "";
    const manifest = ComponentRegistry.getManifest({ budget });
    return `${preamble}Available components:\n${manifest}`.trim();
  }
};
