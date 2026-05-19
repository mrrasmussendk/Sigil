#!/usr/bin/env node
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, extname, join, resolve, sep, posix } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ConfigError,
  describeComponentFiles,
  findConfig,
  loadConfig
} from "../src/discovery.js";

interface DevServerOptions {
  port: number;
  configPath?: string;
  cwd: string;
  noWatch: boolean;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function parseArgs(argv: readonly string[]): DevServerOptions {
  const opts: DevServerOptions = {
    port: Number(process.env.PORT ?? 5173),
    cwd: process.cwd(),
    noWatch: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--port" || arg === "-p") {
      const next = argv[i + 1];
      if (!next) throw new Error(`Missing value for ${arg}`);
      opts.port = Number(next);
      i += 1;
    } else if (arg === "--config") {
      const next = argv[i + 1];
      if (!next) throw new Error(`Missing value for ${arg}`);
      opts.configPath = next;
      i += 1;
    } else if (arg === "--no-watch") {
      opts.noWatch = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log("sigil-dev [--port N] [--config path] [--no-watch]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function ensureInitialBuild(cwd: string): void {
  console.log("[sigil-dev] running tsc (initial build)…");
  const result = spawnSync("npx", ["tsc"], {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  if (result.status !== 0) {
    console.error("[sigil-dev] tsc failed; aborting.");
    process.exit(result.status ?? 1);
  }
}

function startTscWatch(cwd: string): ChildProcess {
  console.log("[sigil-dev] starting tsc --watch in the background…");
  const child = spawn("npx", ["tsc", "--watch", "--preserveWatchOutput"], {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  return child;
}

function safeJoin(root: string, requestPath: string): string | null {
  const decoded = decodeURIComponent(requestPath.split("?")[0]!);
  // Strip trailing /, treat / as root index
  const clean = decoded === "/" || decoded === ""
    ? "/demo/index.html"
    : decoded.endsWith("/")
      ? decoded + "index.html"
      : decoded;
  const target = resolve(root, "." + clean);
  if (!target.startsWith(root + sep) && target !== root) return null;
  return target;
}

function serveFile(filePath: string, res: ServerResponse): void {
  if (!existsSync(filePath)) {
    res.statusCode = 404;
    res.end(`Not found: ${filePath}`);
    return;
  }
  const stat = statSync(filePath);
  if (stat.isDirectory()) {
    res.statusCode = 404;
    res.end(`Is a directory: ${filePath}`);
    return;
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream");
  res.setHeader("Cache-Control", "no-store");
  createReadStream(filePath).pipe(res);
}

interface ComponentsResponse {
  readonly configPath: string;
  readonly mode: "glob" | "registry";
  readonly include: readonly string[];
  readonly exclude: readonly string[];
  readonly files: readonly { source: string; url: string }[];
}

function toUrl(absoluteSrc: string, projectRoot: string): string {
  // The compiled output lives under dist/, mirroring the source tree.
  // Source: <root>/demo/components/banking.ts
  // URL:    /dist/demo/components/banking.js
  const rel = absoluteSrc.slice(projectRoot.length).split(sep).join(posix.sep);
  const withoutLeadingSlash = rel.startsWith("/") ? rel.slice(1) : rel;
  const asJs = withoutLeadingSlash.replace(/\.(ts|mts|tsx)$/, ".js");
  return `/dist/${asJs}`;
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = process.env.SIGIL_MODEL ?? "claude-sonnet-4-6";
const DEFAULT_MAX_TOKENS = 4096;
const AGENT_TIMEOUT_MS = 60_000;

export interface AgentRequestBody {
  prompt: string;
  systemPrompt: string;
  model?: string;
  maxTokens?: number;
}

interface AnthropicSystemBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

interface AnthropicToolSpec {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system: AnthropicSystemBlock[];
  messages: { role: "user" | "assistant"; content: string }[];
  tools?: AnthropicToolSpec[];
  tool_choice?: { type: "auto" | "any" | "tool"; name?: string };
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: unknown;
}

/**
 * The render_ui tool. We force Claude to call it via tool_choice, which
 * means Anthropic validates the tool input against this schema server-side
 * — guaranteed-valid JSON, no string-repair heuristics needed.
 */
const RENDER_UI_TOOL: AnthropicToolSpec = {
  name: "render_ui",
  description:
    "Render the user-facing UI by emitting structured components from the catalog in the system prompt. " +
    "ALWAYS call this tool to reply to the user; do not return prose.",
  input_schema: {
    type: "object",
    properties: {
      components: {
        type: "array",
        description: "One or more components to render, in display order.",
        items: {
          type: "object",
          properties: {
            component: {
              type: "string",
              description: "Tag name from the catalog (e.g. 'stock-quote', 'portfolio-summary')."
            },
            props: {
              type: "object",
              description: "Props matching the catalog entry's schema.",
              additionalProperties: true
            }
          },
          required: ["component"]
        }
      }
    },
    required: ["components"]
  }
};

export interface AnthropicResponse {
  id: string;
  model: string;
  stop_reason: string;
  content: AnthropicContentBlock[];
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

export type AnthropicCaller = (req: AnthropicRequest, apiKey: string) => Promise<AnthropicResponse>;

const defaultCaller: AnthropicCaller = async (body, apiKey) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);
  try {
    const upstream = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const text = await upstream.text();
    if (!upstream.ok) {
      throw new Error(`Anthropic ${upstream.status}: ${text}`);
    }
    return JSON.parse(text) as AnthropicResponse;
  } finally {
    clearTimeout(timer);
  }
};

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  if (!raw) return {};
  return JSON.parse(raw);
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export interface AgentStatusResponse {
  keyConfigured: boolean;
  model: string;
  help?: string;
}

export function handleApiAgentStatus(res: ServerResponse): void {
  const key = process.env.ANTHROPIC_API_KEY;
  const body: AgentStatusResponse = {
    keyConfigured: Boolean(key && key.length > 0),
    model: DEFAULT_MODEL,
    ...(key
      ? {}
      : {
        help: "Set ANTHROPIC_API_KEY in the shell running `npm run dev` to enable the real-agent flow. PowerShell: $env:ANTHROPIC_API_KEY = 'sk-ant-…'"
      })
  };
  sendJson(res, 200, body);
}

export interface AgentReplyBody {
  text: string;
  model: string;
  stopReason: string;
  usage: AnthropicResponse["usage"];
}

export async function handleApiAgent(
  body: AgentRequestBody,
  res: ServerResponse,
  caller: AnthropicCaller = defaultCaller
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    sendJson(res, 503, {
      error: "ANTHROPIC_API_KEY is not set",
      help:
        "The real-agent endpoint requires ANTHROPIC_API_KEY in the environment of the dev server. " +
        "Stop the server, export the key, and start it again. " +
        "PowerShell: `$env:ANTHROPIC_API_KEY = 'sk-ant-…'; npm run dev`"
    });
    return;
  }

  if (typeof body?.prompt !== "string" || body.prompt.length === 0) {
    sendJson(res, 400, { error: "Missing or empty 'prompt'" });
    return;
  }
  if (typeof body.systemPrompt !== "string" || body.systemPrompt.length === 0) {
    sendJson(res, 400, { error: "Missing or empty 'systemPrompt'" });
    return;
  }

  const upstream: AnthropicRequest = {
    model: body.model && body.model.length > 0 ? body.model : DEFAULT_MODEL,
    max_tokens: typeof body.maxTokens === "number" && body.maxTokens > 0
      ? Math.min(body.maxTokens, 8192)
      : DEFAULT_MAX_TOKENS,
    system: [
      // Mark the manifest as ephemeral so the second-and-later requests
      // in a session hit Anthropic's prompt cache.
      { type: "text", text: body.systemPrompt, cache_control: { type: "ephemeral" } }
    ],
    messages: [{ role: "user", content: body.prompt }],
    tools: [RENDER_UI_TOOL],
    tool_choice: { type: "tool", name: RENDER_UI_TOOL.name }
  };

  let response: AnthropicResponse;
  try {
    response = await caller(upstream, apiKey);
  } catch (err) {
    sendJson(res, 502, { error: (err as Error).message });
    return;
  }

  // Prefer the tool_use block (always valid JSON — Anthropic validates it
  // against the input_schema before returning); fall back to text blocks
  // if the model somehow returned text instead of a tool call.
  const toolUse = response.content.find(
    (b): b is AnthropicContentBlock & { type: "tool_use"; name: string; input: unknown } =>
      b.type === "tool_use" && b.name === RENDER_UI_TOOL.name
  );
  const text = toolUse
    ? JSON.stringify(toolUse.input)
    : response.content
        .filter((b): b is AnthropicContentBlock & { text: string } => b.type === "text" && typeof b.text === "string")
        .map((b) => b.text)
        .join("\n");

  const reply: AgentReplyBody = {
    text,
    model: response.model,
    stopReason: response.stop_reason,
    usage: response.usage
  };
  sendJson(res, 200, reply);
}

async function handleApiComponents(
  opts: DevServerOptions,
  res: ServerResponse
): Promise<void> {
  try {
    const configPath = findConfig(opts.cwd, opts.configPath);
    const config = await loadConfig(configPath);
    const configDir = dirname(configPath);
    const include = config.components?.include ?? [];
    const exclude = config.components?.exclude ?? [];

    let files: readonly { source: string; url: string }[] = [];
    let mode: "glob" | "registry" = "registry";

    if (include.length > 0) {
      mode = "glob";
      const discovered = describeComponentFiles(config.components ?? {}, configDir);
      files = discovered.map((m) => ({
        source: m.source,
        url: toUrl(m.absolute, opts.cwd)
      }));
    }

    const body: ComponentsResponse = {
      configPath: configPath.slice(opts.cwd.length + 1).split(sep).join(posix.sep),
      mode,
      include: [...include],
      exclude: [...exclude],
      files
    };
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(body, null, 2));
  } catch (err) {
    res.statusCode = err instanceof ConfigError ? 400 : 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
}

function handleRequest(opts: DevServerOptions, caller: AnthropicCaller = defaultCaller) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = req.url ?? "/";
    const method = req.method ?? "GET";

    if (url.startsWith("/api/components")) {
      await handleApiComponents(opts, res);
      return;
    }
    if (url.startsWith("/api/agent/status")) {
      handleApiAgentStatus(res);
      return;
    }
    if (url.startsWith("/api/agent")) {
      if (method !== "POST") {
        sendJson(res, 405, { error: "Method not allowed. Use POST." });
        return;
      }
      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch (err) {
        sendJson(res, 400, { error: `Invalid JSON: ${(err as Error).message}` });
        return;
      }
      await handleApiAgent(body as AgentRequestBody, res, caller);
      return;
    }

    const filePath = safeJoin(opts.cwd, url);
    if (!filePath) {
      res.statusCode = 403;
      res.end("Forbidden");
      return;
    }
    serveFile(filePath, res);
  };
}

async function main(): Promise<void> {
  let opts: DevServerOptions;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error((err as Error).message);
    process.exitCode = 2;
    return;
  }

  ensureInitialBuild(opts.cwd);

  let watcher: ChildProcess | undefined;
  if (!opts.noWatch) {
    watcher = startTscWatch(opts.cwd);
  }

  const server = createServer(handleRequest(opts));
  const keyState = process.env.ANTHROPIC_API_KEY ? "set" : "MISSING";
  server.listen(opts.port, () => {
    console.log(`[sigil-dev] http://localhost:${opts.port}/demo/`);
    console.log(`[sigil-dev]   GET  /api/components     → runtime component discovery`);
    console.log(`[sigil-dev]   GET  /api/agent/status   → reports whether ANTHROPIC_API_KEY is set`);
    console.log(`[sigil-dev]   POST /api/agent          → proxy to Anthropic Messages API (key: ${keyState})`);
    if (keyState === "MISSING") {
      console.log("[sigil-dev]   note: set $env:ANTHROPIC_API_KEY before starting to enable real-agent flow");
    }
  });

  const shutdown = (): void => {
    console.log("\n[sigil-dev] shutting down…");
    server.close();
    watcher?.kill();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// Only run when invoked directly, not when imported by tests.
const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  await main();
}

export { handleApiComponents, toUrl };
// Already exported above: handleApiAgent, handleApiAgentStatus, types
