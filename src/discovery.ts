import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { globSync } from "node:fs";
import { dirname, posix, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { ComponentRegistry } from "./registry.js";
import {
  CONFIG_DEFAULT_FILES,
  type SigilConfig,
  type ComponentsConfig
} from "./config.js";
import type { ComponentDeclarationPublic } from "./types.js";

/**
 * Node-only helpers backing the sigil CLI. These are intentionally split
 * out from the main entry so browser bundles never pull in `node:fs`.
 */

const DEFAULT_OUTPUT = "sigil.components.generated.ts";

function toPosix(p: string): string {
  return p.split(sep).join(posix.sep);
}

function ensureRelativePrefix(p: string): string {
  return p.startsWith(".") ? p : `./${p}`;
}

export interface ResolvedDiscovery {
  /** Absolute paths of all matched component files, sorted. */
  readonly files: readonly string[];
  /** Absolute path the barrel will/would be written to. */
  readonly outputPath: string;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Locate the user's config file. Honors an explicit path; otherwise walks
 * the {@link CONFIG_DEFAULT_FILES} candidates inside `cwd`.
 */
export function findConfig(cwd: string, explicit?: string): string {
  if (explicit) {
    const abs = resolve(cwd, explicit);
    if (!existsSync(abs)) throw new ConfigError(`Config not found: ${abs}`);
    return abs;
  }
  for (const candidate of CONFIG_DEFAULT_FILES) {
    const abs = resolve(cwd, candidate);
    if (existsSync(abs)) return abs;
  }
  throw new ConfigError(
    `No sigil config file found in ${cwd}. Looked for: ${CONFIG_DEFAULT_FILES.join(", ")}.`
  );
}

/**
 * Dynamically import a config file. Works with `.ts` when invoked under a
 * TypeScript loader (tsx, node --experimental-strip-types, etc.).
 */
export async function loadConfig(configPath: string): Promise<SigilConfig> {
  const href = pathToFileURL(configPath).href;
  const mod = (await import(href)) as { default?: unknown };
  if (!mod.default || typeof mod.default !== "object") {
    throw new ConfigError(
      `Config at ${configPath} must \`export default\` a SigilConfig object.`
    );
  }
  return mod.default as SigilConfig;
}

/**
 * Expand `components.include` (and apply `components.exclude`) into absolute
 * file paths.
 */
export function resolveComponentFiles(
  config: ComponentsConfig,
  configDir: string
): ResolvedDiscovery {
  const include = config.include ?? [];
  const exclude = config.exclude ?? [];
  const outputPath = resolve(configDir, config.output ?? DEFAULT_OUTPUT);

  if (include.length === 0) {
    return { files: [], outputPath };
  }

  const matched = new Set<string>();
  for (const pattern of include) {
    const results = globSync(pattern, {
      cwd: configDir,
      exclude: exclude.length > 0 ? Array.from(exclude) : undefined
    });
    for (const file of results) {
      const abs = resolve(configDir, file);
      // Never include the barrel itself if a glob would have matched it.
      if (abs === outputPath) continue;
      matched.add(abs);
    }
  }
  const files = Array.from(matched).sort();
  return { files, outputPath };
}

/**
 * Write a deterministic side-effect barrel. Idempotent: regenerating with
 * the same inputs produces byte-identical output.
 */
export function writeComponentBarrel(
  files: readonly string[],
  outputPath: string
): void {
  const outDir = dirname(outputPath);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const lines = [
    "// THIS FILE IS GENERATED — do not edit.",
    "// Regenerate with `npx sigil gen` (or `npm run gen:components`).",
    "// Source: sigil.config.ts → components.include",
    ""
  ];
  for (const abs of files) {
    let rel = relative(outDir, abs);
    rel = toPosix(rel);
    rel = ensureRelativePrefix(rel);
    rel = rel.replace(/\.(ts|mts|tsx)$/, ".js");
    lines.push(`import ${JSON.stringify(rel)};`);
  }
  lines.push("");
  writeFileSync(outputPath, lines.join("\n"));
}

/**
 * Runtime helper for the "registry" discovery mode. Returns whatever
 * components have been registered so far via decorators or manual
 * `ComponentRegistry.register` calls.
 */
export function getRegisteredComponents(): readonly ComponentDeclarationPublic[] {
  return ComponentRegistry.getAll();
}

export interface DiscoveredModule {
  /** Path relative to the config file's directory (POSIX separators). */
  readonly source: string;
  /** Absolute filesystem path of the source `.ts` file. */
  readonly absolute: string;
}

/**
 * Like {@link resolveComponentFiles} but returns metadata that's friendly
 * to serve over HTTP (relative POSIX paths). Used by the dev server.
 */
export function describeComponentFiles(
  config: ComponentsConfig,
  configDir: string
): readonly DiscoveredModule[] {
  const { files } = resolveComponentFiles(config, configDir);
  return files.map((abs) => ({
    absolute: abs,
    source: toPosix(relative(configDir, abs))
  }));
}

/**
 * One-shot convenience: load config, resolve files, write the barrel.
 * Returns the resolution result for callers that want to log or inspect.
 */
export async function runDiscovery(options: {
  configPath?: string;
  cwd?: string;
}): Promise<ResolvedDiscovery & { configPath: string; mode: "glob" | "registry" }> {
  const cwd = options.cwd ?? process.cwd();
  const configPath = findConfig(cwd, options.configPath);
  const config = await loadConfig(configPath);
  const components = config.components ?? {};

  const resolution = resolveComponentFiles(components, dirname(configPath));

  if (!components.include || components.include.length === 0) {
    return { ...resolution, configPath, mode: "registry" };
  }

  writeComponentBarrel(resolution.files, resolution.outputPath);
  return { ...resolution, configPath, mode: "glob" };
}
