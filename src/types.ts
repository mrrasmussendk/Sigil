/**
 * Public type surface for Sigil.
 * Everything user code should reason about lives here.
 */

/** Coarse kind of a prop declaration — used as the discriminant for {@link PropDecl}. */
export type PropType = "string" | "number" | "boolean" | "array" | "enum" | "token";

interface PropDeclBase {
  description?: string;
  required: boolean;
}

export interface StringPropDecl extends PropDeclBase {
  type: "string";
}

export interface NumberPropDecl extends PropDeclBase {
  type: "number";
  min?: number;
  max?: number;
}

export interface BooleanPropDecl extends PropDeclBase {
  type: "boolean";
}

export interface ArrayPropDecl extends PropDeclBase {
  type: "array";
  items: string;
}

export interface EnumPropDecl extends PropDeclBase {
  type: "enum";
  values: readonly string[];
}

/**
 * A reference to a design token (DTCG). `group`, when set, constrains the
 * acceptable `$type` of the resolved token (e.g. `"color"`, `"dimension"`).
 */
export interface TokenPropDecl extends PropDeclBase {
  type: "token";
  group?: string;
}

/** Discriminated union of all prop shapes the registry understands. */
export type PropDecl =
  | StringPropDecl
  | NumberPropDecl
  | BooleanPropDecl
  | ArrayPropDecl
  | EnumPropDecl
  | TokenPropDecl;

export interface SlotDecl {
  description?: string;
  required: boolean;
}

export interface ComponentDeclaration {
  readonly tag: string;
  readonly description: string;
  readonly props: Record<string, PropDecl>;
  readonly slots: Record<string, SlotDecl>;
  readonly constructor: CustomElementConstructor;
}

/** Same as {@link ComponentDeclaration} but without the constructor — safe to serialize. */
export type ComponentDeclarationPublic = Omit<ComponentDeclaration, "constructor">;

export type ManifestBudget = "minimal" | "standard" | "full";

export interface ManifestOptions {
  budget?: ManifestBudget;
}

export interface SystemPromptOptions extends ManifestOptions {
  /** Set false to omit the boilerplate JSON-shape preamble. */
  preamble?: boolean;
}

export interface UINode {
  component: string;
  props?: Record<string, unknown>;
  children?: string | UINode[];
  slots?: Record<string, string | UINode[]>;
}

export type ParseResult =
  | { readonly type: "ui"; readonly nodes: readonly UINode[] }
  | { readonly type: "text"; readonly content: string };

export type Severity = "error" | "warning";

export interface ValidationError {
  readonly prop: string;
  readonly message: string;
  readonly severity: Severity;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
}

/**
 * Options accepted by `@prop`.
 * Supply `type` (and `items`/`values` where applicable) to register the prop
 * at class-definition time. If `type` is omitted, the runtime will fall back
 * to inferring from the initial value of the field on first construction.
 */
export interface PropOptions {
  type?: PropType;
  required?: boolean;
  values?: readonly string[];
  min?: number;
  max?: number;
  items?: string;
  /** For `type: "token"`, restrict to tokens whose DTCG `$type` matches this group. */
  group?: string;
}

export interface SlotOptions {
  required?: boolean;
}
