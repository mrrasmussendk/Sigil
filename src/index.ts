import "./polyfills.js";

export { ComponentRegistry, ComponentRegistryImpl } from "./registry.js";
export { agent, prop, slot, tag } from "./decorators.js";
export { Sigil, parseResponse, validateNode } from "./runtime.js";
export { SigilRenderer } from "./renderer.js";
export { DesignTokens, DesignTokensImpl, looksLikeTokenPath } from "./tokens.js";

export type {
  ArrayPropDecl,
  BooleanPropDecl,
  ComponentDeclaration,
  ComponentDeclarationPublic,
  EnumPropDecl,
  ManifestBudget,
  ManifestOptions,
  NumberPropDecl,
  ParseResult,
  PropDecl,
  PropOptions,
  PropType,
  Severity,
  SlotDecl,
  SlotOptions,
  StringPropDecl,
  SystemPromptOptions,
  TokenPropDecl,
  UINode,
  ValidationError,
  ValidationResult
} from "./types.js";

export type { SigilType } from "./runtime.js";
export type { SigilRendererOptions } from "./renderer.js";
export type { DesignTokenFile, DesignTokenLeaf, TokenEntry } from "./tokens.js";
export type { InferredPropShape } from "./utils.js";
