#!/usr/bin/env node
import { relative } from "node:path";
import { ConfigError, runDiscovery } from "../src/discovery.js";

interface CliArgs {
  configPath?: string;
  cwd: string;
  quiet: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { cwd: process.cwd(), quiet: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--cwd" || arg === "-C") {
      const next = argv[i + 1];
      if (!next) throw new Error(`Missing value for ${arg}`);
      args.cwd = next;
      i += 1;
    } else if (arg === "--quiet" || arg === "-q") {
      args.quiet = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (!arg.startsWith("-") && !args.configPath) {
      args.configPath = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function printHelp(): void {
  const lines = [
    "sigil gen — generate the component side-effect barrel from your config.",
    "",
    "Usage:",
    "  sigil gen [config-path] [options]",
    "",
    "Options:",
    "  -C, --cwd <dir>   Run as if started in <dir> (default: process.cwd())",
    "  -q, --quiet       Suppress non-error output",
    "  -h, --help        Show this help"
  ];
  console.log(lines.join("\n"));
}

async function main(): Promise<void> {
  let args: CliArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error((err as Error).message);
    process.exitCode = 2;
    return;
  }

  try {
    const result = await runDiscovery({ configPath: args.configPath, cwd: args.cwd });
    if (args.quiet) return;

    const configRel = relative(args.cwd, result.configPath) || result.configPath;
    if (result.mode === "registry") {
      console.log(`[sigil] ${configRel}: no component glob configured — runtime will read from the global registry.`);
      return;
    }
    const outRel = relative(args.cwd, result.outputPath) || result.outputPath;
    console.log(`[sigil] ${configRel}: wrote ${result.files.length} import${result.files.length === 1 ? "" : "s"} → ${outRel}`);
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`[sigil] ${err.message}`);
      process.exitCode = 1;
      return;
    }
    throw err;
  }
}

await main();
