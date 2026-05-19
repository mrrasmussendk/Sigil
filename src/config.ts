import type { ManifestBudget } from "./types.js";

/**
 * Config file types for `sigil.config.ts`.
 *
 * Two component-discovery modes are supported:
 *
 *  1. **Glob** — set `components.include` to one or more globs. Running
 *     `npx sigil gen` writes a side-effect barrel at `components.output`
 *     that imports every matched file, populating the global
 *     {@link ComponentRegistry} when the app starts.
 *
 *  2. **Registry** — omit `components.include`. The CLI prints a notice and
 *     does nothing; the application is responsible for importing component
 *     modules elsewhere. At runtime, the registry is the single source of
 *     truth (see {@link getRegisteredComponents}).
 *
 * Both modes converge on the same runtime API — the only difference is who
 * is responsible for *loading* the component modules.
 */
export interface SigilConfig {
  components?: ComponentsConfig;
  manifest?: ManifestConfig;
}

export interface ComponentsConfig {
  /**
   * Glob patterns (relative to the directory containing the config file).
   * If omitted, the CLI runs in "registry" mode and emits nothing.
   */
  include?: readonly string[];
  /** Glob patterns to exclude from the matched set. */
  exclude?: readonly string[];
  /**
   * Where to emit the generated side-effect barrel, relative to the config
   * file's directory. Defaults to `sigil.components.generated.ts`.
   */
  output?: string;
}

export interface ManifestConfig {
  /** Default manifest budget used by tooling. */
  budget?: ManifestBudget;
  /** If set, the CLI writes the rendered manifest to this path. */
  output?: string;
}

/**
 * Identity helper that gives IDE intellisense and type-checking inside the
 * user's `sigil.config.ts`. Equivalent to typing the literal yourself.
 */
export function defineConfig(config: SigilConfig): SigilConfig {
  return config;
}

/** File names that {@link findConfig} looks for when no path is supplied. */
export const CONFIG_DEFAULT_FILES: readonly string[] = [
  "sigil.config.ts",
  "sigil.config.mts",
  "sigil.config.js",
  "sigil.config.mjs"
] as const;
