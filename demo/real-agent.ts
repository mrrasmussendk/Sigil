/**
 * Browser client for the real (Claude-backed) agent endpoint.
 *
 * The dev server's `/api/agent` endpoint requires `ANTHROPIC_API_KEY` to
 * be set in the environment of the process running `npm run dev`. The
 * status endpoint reports whether that key is present so the UI can grey
 * the option out instead of silently failing.
 */

export interface AgentStatus {
  readonly keyConfigured: boolean;
  readonly model: string;
  readonly help?: string;
}

export interface AgentResult {
  /** The LLM's raw text reply — feed to `Sigil.parse`. */
  readonly text: string;
  readonly model: string;
  readonly stopReason: string;
  readonly usage: {
    readonly input_tokens: number;
    readonly output_tokens: number;
    readonly cache_creation_input_tokens?: number;
    readonly cache_read_input_tokens?: number;
  };
}

export interface AgentErrorBody {
  readonly error: string;
  readonly help?: string;
}

export class RealAgentError extends Error {
  constructor(message: string, public readonly status: number, public readonly help?: string) {
    super(message);
    this.name = "RealAgentError";
  }
}

export async function fetchAgentStatus(): Promise<AgentStatus> {
  const response = await fetch("/api/agent/status");
  if (!response.ok) {
    throw new RealAgentError(`Status check failed: ${response.status}`, response.status);
  }
  return (await response.json()) as AgentStatus;
}

export interface RealAgentRequest {
  prompt: string;
  systemPrompt: string;
  model?: string;
  maxTokens?: number;
}

export async function callRealAgent(request: RealAgentRequest): Promise<AgentResult> {
  const response = await fetch("/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request)
  });
  if (!response.ok) {
    const errBody = (await response.json().catch(() => ({ error: response.statusText }))) as AgentErrorBody;
    throw new RealAgentError(errBody.error, response.status, errBody.help);
  }
  return (await response.json()) as AgentResult;
}

/**
 * Find the end index (inclusive) of the JSON value starting at `start`,
 * which must be `{` or `[`. Returns -1 if unbalanced.
 */
function findJsonEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]!;
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === '"') { inString = false; continue; }
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "{" || ch === "[") depth += 1;
    else if (ch === "}" || ch === "]") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

interface ComponentNode {
  component?: string;
  components?: ComponentNode[];
  props?: Record<string, unknown>;
}

/**
 * Scan the text for every top-level JSON value, parse each, and merge them
 * into a single `{ components: [...] }` payload. Handles:
 *  - a single object/array (passes through)
 *  - multiple concatenated objects (LLMs sometimes emit a JSON stream)
 *  - JSON with prose around it
 *  - top-level arrays
 *
 * Returns null if no valid JSON value is found.
 */
function mergeJsonStream(text: string): string | null {
  const values: unknown[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (ch !== "{" && ch !== "[") {
      i += 1;
      continue;
    }
    const end = findJsonEnd(text, i);
    if (end < 0) break;
    const slice = text.slice(i, end + 1);
    try {
      values.push(JSON.parse(slice));
    } catch {
      // not a self-contained value, skip past this opening brace
    }
    i = end + 1;
  }
  if (values.length === 0) return null;
  if (values.length === 1) return JSON.stringify(values[0]);

  // Multiple top-level values → flatten into one components array.
  const nodes: ComponentNode[] = [];
  const accept = (v: unknown): void => {
    if (!v) return;
    if (Array.isArray(v)) {
      for (const item of v) accept(item);
      return;
    }
    if (typeof v !== "object") return;
    const obj = v as ComponentNode;
    if (typeof obj.component === "string") {
      nodes.push(obj);
    } else if (Array.isArray(obj.components)) {
      for (const item of obj.components) accept(item);
    }
  };
  for (const v of values) accept(v);
  return JSON.stringify({ components: nodes });
}

/**
 * Normalise an LLM reply into a single JSON value that `Sigil.parse` will
 * accept. Strips markdown fences, ignores prose, and merges concatenated
 * JSON objects (which Claude occasionally emits despite instructions).
 * Falls back to the original text if no JSON is found.
 */
export function extractJsonEnvelope(text: string): string {
  // 1. Pull contents out of any ```json … ``` fence first.
  const fence = text.match(/```(?:json|JSON)?\s*\n([\s\S]+?)\n\s*```/);
  const candidate = fence && fence[1] ? fence[1].trim() : text;

  // 2. Merge a possible JSON stream into a single value.
  const merged = mergeJsonStream(candidate);
  if (merged) return merged;

  // 3. Last-resort heuristic: slice from first brace to last.
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return candidate.slice(firstBrace, lastBrace + 1);
  }
  return candidate;
}
