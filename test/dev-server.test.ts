import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { Writable } from "node:stream";

import {
  handleApiAgent,
  handleApiAgentStatus,
  handleApiComponents,
  toUrl,
  type AgentRequestBody,
  type AnthropicCaller,
  type AnthropicResponse
} from "../scripts/dev-server.js";

function scaffold(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "sigil-dev-"));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/** Tiny mock conforming to the shape `handleApiComponents` uses on `res`. */
function makeMockRes(): MockResponse & {
  setHeader(k: string, v: string): void;
  end(body?: string): void;
} {
  const state: MockResponse = { statusCode: 0, headers: {}, body: "" };
  return Object.assign(state, {
    setHeader(k: string, v: string): void { state.headers[k.toLowerCase()] = v; },
    end(body?: string): void { state.body = body ?? ""; }
  });
}

test("toUrl maps absolute source paths to /dist/ URLs and rewrites the extension", () => {
  const root = resolve("/tmp/proj");
  const src = resolve(root, "demo", "components", "banking.ts");
  assert.equal(toUrl(src, root), "/dist/demo/components/banking.js");
});

test("/api/components returns mode=glob with mapped URLs when include is set", async () => {
  const { dir, cleanup } = scaffold();
  try {
    mkdirSync(join(dir, "comps"));
    writeFileSync(join(dir, "comps", "foo.ts"), "");
    writeFileSync(join(dir, "comps", "bar.ts"), "");
    writeFileSync(
      join(dir, "sigil.config.mjs"),
      `export default { components: { include: ["comps/**/*.ts"] } };\n`
    );

    const res = makeMockRes();
    await handleApiComponents({ port: 0, cwd: dir, noWatch: true }, res as unknown as import("node:http").ServerResponse);

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["content-type"], "application/json; charset=utf-8");

    const body = JSON.parse(res.body) as {
      mode: string;
      include: string[];
      files: { source: string; url: string }[];
    };
    assert.equal(body.mode, "glob");
    assert.deepEqual(body.include, ["comps/**/*.ts"]);
    assert.equal(body.files.length, 2);
    for (const f of body.files) {
      assert.match(f.url, /^\/dist\/comps\/(foo|bar)\.js$/);
      assert.match(f.source, /^comps\/(foo|bar)\.ts$/);
    }
  } finally {
    cleanup();
  }
});

test("/api/components returns mode=registry when no include is configured", async () => {
  const { dir, cleanup } = scaffold();
  try {
    writeFileSync(
      join(dir, "sigil.config.mjs"),
      `export default { components: {} };\n`
    );

    const res = makeMockRes();
    await handleApiComponents({ port: 0, cwd: dir, noWatch: true }, res as unknown as import("node:http").ServerResponse);

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body) as { mode: string; files: unknown[] };
    assert.equal(body.mode, "registry");
    assert.equal(body.files.length, 0);
  } finally {
    cleanup();
  }
});

test("/api/components returns 400 with a clear message when no config exists", async () => {
  const { dir, cleanup } = scaffold();
  try {
    const res = makeMockRes();
    await handleApiComponents({ port: 0, cwd: dir, noWatch: true }, res as unknown as import("node:http").ServerResponse);
    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body) as { error: string };
    assert.match(body.error, /No sigil config file found/);
  } finally {
    cleanup();
  }
});

// Sanity: makes sure the unused import keeps `Writable` from being lint-trimmed
// if a future test wires up streaming; harmless otherwise.
void Writable;

// --- /api/agent/status ---

test("/api/agent/status reports keyConfigured=false when ANTHROPIC_API_KEY is unset", () => {
  const original = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const res = makeMockRes();
    handleApiAgentStatus(res as unknown as import("node:http").ServerResponse);
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body) as { keyConfigured: boolean; model: string; help?: string };
    assert.equal(body.keyConfigured, false);
    assert.ok(body.help, "expected a help string when key is missing");
    assert.ok(body.model.length > 0);
  } finally {
    if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
  }
});

test("/api/agent/status reports keyConfigured=true when ANTHROPIC_API_KEY is set", () => {
  const original = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  try {
    const res = makeMockRes();
    handleApiAgentStatus(res as unknown as import("node:http").ServerResponse);
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body) as { keyConfigured: boolean; help?: string };
    assert.equal(body.keyConfigured, true);
    assert.equal(body.help, undefined);
  } finally {
    if (original === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = original;
  }
});

// --- /api/agent ---

function cannedResponse(text: string): AnthropicResponse {
  return {
    id: "msg_test",
    model: "claude-sonnet-4-6",
    stop_reason: "end_turn",
    content: [{ type: "text", text }],
    usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0 }
  };
}

test("/api/agent returns 503 when ANTHROPIC_API_KEY is missing", async () => {
  const original = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const res = makeMockRes();
    const body: AgentRequestBody = { prompt: "hi", systemPrompt: "system" };
    await handleApiAgent(body, res as unknown as import("node:http").ServerResponse);
    assert.equal(res.statusCode, 503);
    const parsed = JSON.parse(res.body) as { error: string; help?: string };
    assert.match(parsed.error, /ANTHROPIC_API_KEY is not set/);
    assert.ok(parsed.help);
  } finally {
    if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
  }
});

test("/api/agent returns 400 when prompt or systemPrompt is missing", async () => {
  const original = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  try {
    // missing prompt
    let res = makeMockRes();
    await handleApiAgent(
      { prompt: "", systemPrompt: "system" } as AgentRequestBody,
      res as unknown as import("node:http").ServerResponse
    );
    assert.equal(res.statusCode, 400);
    assert.match((JSON.parse(res.body) as { error: string }).error, /prompt/);

    // missing systemPrompt
    res = makeMockRes();
    await handleApiAgent(
      { prompt: "hi", systemPrompt: "" } as AgentRequestBody,
      res as unknown as import("node:http").ServerResponse
    );
    assert.equal(res.statusCode, 400);
    assert.match((JSON.parse(res.body) as { error: string }).error, /systemPrompt/);
  } finally {
    if (original === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = original;
  }
});

test("/api/agent forwards to Anthropic with cache_control and returns the joined text", async () => {
  const original = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  try {
    interface CapturedCall {
      key: string;
      system: { cache_control?: { type: string } }[];
      model: string;
      messages: { role: string; content: string }[];
    }
    const captured: CapturedCall[] = [];
    const caller: AnthropicCaller = async (req, key) => {
      captured.push({ key, system: req.system, model: req.model, messages: req.messages });
      return cannedResponse(`{"component":"alert-banner","props":{"severity":"info","title":"hi","message":"there"}}`);
    };

    const res = makeMockRes();
    await handleApiAgent(
      { prompt: "what's up?", systemPrompt: "Available components: …" },
      res as unknown as import("node:http").ServerResponse,
      caller
    );

    assert.equal(res.statusCode, 200);
    assert.equal(captured.length, 1);
    const call = captured[0]!;
    assert.equal(call.key, "sk-ant-test");
    assert.equal(call.system[0]!.cache_control?.type, "ephemeral");
    assert.equal(call.messages[0]!.content, "what's up?");

    const body = JSON.parse(res.body) as { text: string; model: string; stopReason: string };
    assert.match(body.text, /alert-banner/);
    assert.equal(body.stopReason, "end_turn");
    assert.equal(body.model, "claude-sonnet-4-6");
  } finally {
    if (original === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = original;
  }
});

test("/api/agent surfaces upstream errors as 502", async () => {
  const original = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  try {
    const caller: AnthropicCaller = async () => {
      throw new Error("Anthropic 429: rate limited");
    };
    const res = makeMockRes();
    await handleApiAgent(
      { prompt: "hi", systemPrompt: "system" },
      res as unknown as import("node:http").ServerResponse,
      caller
    );
    assert.equal(res.statusCode, 502);
    assert.match((JSON.parse(res.body) as { error: string }).error, /rate limited/);
  } finally {
    if (original === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = original;
  }
});
