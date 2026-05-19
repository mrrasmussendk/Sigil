# sigil

A TypeScript framework for letting an LLM agent drive a real UI by emitting
structured component instances instead of free-form text. The agent gets a
typed catalog of available components in its system prompt; it responds with
JSON; the framework parses, validates, and renders that JSON as actual
web-component DOM in the browser.

A decorator is literally a mark on a class. Sigils are symbols that carry
intent — which is exactly what `@agent`, `@tag`, `@prop`, and `@slot` do
here. Hence the name.

```
   ┌──────────────┐         ┌─────────────┐        ┌──────────────┐
   │  Your app    │  ──▶    │   LLM call  │  ──▶   │  Agent JSON  │
   │  declares    │ system  │             │ chat   │              │
   │  components  │ prompt  │             │ reply  │  { component:│
   │  with        │ ◀──     │             │        │   "...",     │
   │  decorators  │         │             │        │   "props": … │
   └──────────────┘         └─────────────┘        └──────┬───────┘
          │                                                │
          │ ComponentRegistry         Sigil.parse          │
          │ + Sigil.buildSystemPrompt Sigil.validate       │
          ▼                                                ▼
   ┌──────────────┐                                ┌──────────────┐
   │   Manifest   │                                │ SigilRenderer│
   │ for the LLM  │                                │  → real DOM  │
   └──────────────┘                                └──────────────┘
```

## Status

`0.1.0` — pre-publish, source available, working finance demo. Strict
TypeScript throughout (`strict`, `noUncheckedIndexedAccess`,
`noImplicitOverride`). ESM (`NodeNext`). Stage 3 decorators with
`Symbol.metadata` (polyfilled).

## Install

```powershell
npm install
npm run build      # tsc → dist/
npm test           # 25 tests
npm run dev        # dev server with runtime discovery on :5173
```

Open <http://localhost:5173/demo/> for the finance demo.

## 60-second tour

```ts
import { agent, prop, tag, Sigil, SigilRenderer } from "sigil";

@agent("Live stock quote with price, change, and a 30-point sparkline.")
@tag("stock-quote")
class StockQuoteElement extends HTMLElement {
  @prop("Ticker symbol", { type: "string", required: true })
  accessor ticker = "";

  @prop("Last price", { type: "number", required: true, min: 0 })
  accessor price = 0;

  @prop("Trend", { values: ["up", "down", "flat"] })
  accessor trend: "up" | "down" | "flat" = "flat";

  connectedCallback() {
    this.innerHTML = `<article>${this.ticker} — $${this.price.toFixed(2)}</article>`;
  }
}

// 1. The system prompt the LLM sees.
const systemPrompt = Sigil.buildSystemPrompt({ budget: "minimal" });
// "Available components:
//  stock-quote(ticker:str!, price:float!, trend:up|down|flat) — Live stock quote with…"

// 2. Parse what the LLM replied with.
const parsed = Sigil.parse(`{
  "component": "stock-quote",
  "props": { "ticker": "NVDA", "price": 945.80, "trend": "up" }
}`);

// 3. Render it.
if (parsed.type === "ui") {
  const renderer = new SigilRenderer(document.body);
  renderer.render(parsed.nodes);
}
```

The decorators register the class as a custom element AND populate a
metadata catalog the LLM sees. Required props, enums, and number ranges are
enforced before render — bad agent output is surfaced as a validation
error, not as broken DOM.

## Concepts

### Decorators

| Decorator | Target | What it does |
|---|---|---|
| `@tag(name)` | class | Declares the custom-element tag. Must contain a hyphen per HTML spec (the runtime rejects e.g. `watchlist` — use `watch-list`). |
| `@agent(description)` | class | Marks the class as agent-renderable and registers it with `ComponentRegistry`. Class must extend `HTMLElement`. |
| `@prop(description, options)` | field / `accessor` | Declares a prop the agent can set. With explicit `type` in `options`, the catalog is populated at class-definition time via `Symbol.metadata` — no instances required for `buildSystemPrompt` to be complete. |
| `@slot(description, options)` | field / `accessor` / method | Declares a named slot. Field names like `headerSlot` map to slot name `header`; `defaultSlot` maps to `default`. |

### Prop types

`PropDecl` is a discriminated union — `type` is the discriminant.

| `type` | Options | Manifest shorthand | Notes |
|---|---|---|---|
| `"string"` | `required` | `str` / `str!` | Empty string counts as missing for required check. |
| `"number"` | `required`, `min`, `max` | `float` / `float!` | Validator enforces min/max. |
| `"boolean"` | `required` | `bool` / `bool!` | |
| `"array"` | `required`, `items` | `arr` / `arr!` | `items` is a free-form string hint (e.g. `"number"`, `"object"`). |
| `"enum"` | `required`, `values` | `a\|b\|c` | Validator rejects values not in the list. |
| `"token"` | `required`, `group` | `tok` / `tok<color>` | Reference to a design token by dot-path; see [Design tokens](#design-tokens). |

### Registry

```ts
import { ComponentRegistry } from "sigil";

ComponentRegistry.size;                  // number of registered components
ComponentRegistry.has("stock-quote");    // boolean
ComponentRegistry.get("stock-quote");    // public view (no constructor ref)
ComponentRegistry.getAll();              // public view of everything
ComponentRegistry.getManifest({ budget: "minimal" });  // string for the LLM
```

The registry is a singleton (`ComponentRegistryImpl` is also exported if
you want to instantiate your own).

### Runtime

```ts
import { Sigil } from "sigil";

Sigil.buildSystemPrompt({ budget, preamble });  // string
Sigil.parse(text);                              // { type: "ui", nodes } | { type: "text", content }
Sigil.validate(node);                           // { valid, errors }
```

`parse` accepts either a single node `{ "component": "...", "props": {…} }`
or a batch `{ "components": [...] }`. Non-JSON or unrecognised JSON falls
through to `{ type: "text", content }` so the agent can also reply with
plain text.

#### Manifest budgets

| Budget | Use case | Approx size for the demo |
|---|---|---|
| `minimal` | Production system prompts, low token cost. | `stock-quote(ticker:str!, …) — Live stock quote…` |
| `standard` | When the LLM also needs slot info and number ranges. | One paragraph per component. |
| `full` | Debugging, machine consumers. JSON dump of `getAll()`. | Big. |

### Renderer

```ts
const renderer = new SigilRenderer(container, {
  resolveTokenProps: true    // rewrite token-typed prop values to var(--…)
});
renderer.render(nodes);
renderer.clear();
```

`render` validates each node first; if validation fails, the node is still
created but props are *not* applied (so you see structural fallback instead
of corrupted state). Slots accept either a plain string (becomes a
text-`<span>`) or an array of `UINode` (recursively rendered into the slot).

### Design tokens

DTCG (Design Tokens Community Group) JSON in, CSS custom properties out,
plus token-typed prop validation.

```ts
import { DesignTokens } from "sigil";

DesignTokens.load({
  color: {
    $type: "color",
    brand: { primary: { $value: "#6aa7ff" }, accent: { $value: "{color.brand.primary}" } }
  },
  space: {
    $type: "dimension",
    sm: { $value: "8px" }, md: { $value: "16px" }
  }
});

DesignTokens.size;                           // 4
DesignTokens.resolve("color.brand.accent");  // { path, type:"color", value:"#6aa7ff", raw:"{color.brand.primary}" }
DesignTokens.cssVarRef("color.brand.accent"); // "var(--color-brand-accent)"
DesignTokens.toCss();                         // ":root { --color-brand-accent: #6aa7ff; … }"
DesignTokens.mountStyles();                   // idempotently inserts the CSS into <head>
DesignTokens.list({ type: "color" });         // filter by DTCG $type
```

`mountStyles({ target?, selector?, id? })` is the page-level entry point —
call it once at boot. Re-calling updates the existing `<style>` block in
place (no duplicate nodes) so theme swaps stay live. Defaults: `target =
document.head`, `selector = ":root"`, `id = "default"`.

Alias references (`{path.to.token}`) are resolved at load time, with a
guard against circular aliases. Inherited `$type` from parent groups is
respected.

#### Token-typed props

```ts
@prop("Background", { type: "token", group: "color" })
accessor background = "";

// Agent JSON:
//   { "component": "...", "props": { "background": "color.brand.primary" } }
//
// SigilRenderer (with resolveTokenProps: true) sets:
//   element.background = "var(--color-brand-primary)"
```

If `DesignTokens` is populated, the validator rejects unknown paths and
optionally enforces `group` (the resolved token's `$type`). If no tokens
are loaded, validation skips the path check — useful when the agent emits
token references that your CSS resolves elsewhere.

The system prompt automatically gains an "Available design tokens" section
when `DesignTokens.size > 0`.

### Slots

Field naming convention:

```ts
class CardElement extends HTMLElement {
  @slot("Card header content") accessor headerSlot = "";   // slot name: "header"
  @slot("Footer", { required: true }) accessor footerSlot = "";
  @slot("Default slot") accessor defaultSlot = "";          // slot name: "default"
}
```

Agent emits slots as either text or nested nodes:

```json
{
  "component": "card",
  "slots": {
    "header": "Q3 Earnings",
    "footer": [{ "component": "stock-quote", "props": {"ticker": "NVDA", "price": 945.80} }]
  }
}
```

## Component discovery

Three ways to get component modules loaded so their decorators run and
their declarations land in `ComponentRegistry`. Pick the one that matches
your environment.

| Mode | When to use | Setup |
|---|---|---|
| **Explicit imports** | Small projects, prod bundles. | `import "./components/foo.js"` at the top of your entrypoint. |
| **Codegen barrel** | CI/prod builds without a dev server. | Write `sigil.config.ts`; run `npx sigil gen`; import the generated `*.generated.ts`. |
| **Runtime discovery** | Dev experience. Add a new file → refresh → it appears. | Write `sigil.config.ts`; run `npm run dev`; the browser fetches `/api/components` at startup. |

### `sigil.config.ts`

The single source of truth for both codegen and runtime modes:

```ts
import { defineConfig } from "sigil/config";

export default defineConfig({
  components: {
    include: ["demo/components/**/*.ts"],         // omit for registry-only mode
    exclude: ["**/*.generated.ts", "**/*.test.ts"],
    output:  "demo/components.generated.ts"        // codegen target
  },
  manifest: {
    budget: "minimal"
  }
});
```

If `components.include` is omitted, both the CLI and the dev server fall
into "registry mode": no glob expansion happens; the application is
responsible for importing component files elsewhere; `ComponentRegistry`
is the runtime source of truth.

### CLI — codegen barrel

```powershell
npx sigil gen           # uses ./sigil.config.ts
npx sigil gen --quiet
npx sigil gen ./other.config.ts
npx sigil gen --cwd ./packages/app
```

Writes a deterministic file like:

```ts
// THIS FILE IS GENERATED — do not edit.
import "./components/banking.js";
import "./components/credit.js";
import "./components/market.js";
import "./components/portfolio.js";
import "./components/trading.js";
```

Generated files are in `.gitignore` (`**/*.generated.ts`). Re-running
produces byte-identical output if inputs haven't changed.

### Dev server — runtime discovery

```powershell
npm run dev                        # initial tsc + tsc --watch + HTTP server on :5173
npm run dev -- --port 8080
npm run dev -- --no-watch
npm run dev -- --config ./other.config.ts
```

What it does:

1. Runs `tsc` once (initial compile), then `tsc --watch` in the
   background.
2. Serves static files (`dist/`, `demo/`, anything under project root).
3. Exposes `GET /api/components` which calls `runDiscovery()` per request
   and returns:

```json
{
  "configPath": "sigil.config.ts",
  "mode": "glob",
  "include": ["demo/components/**/*.ts"],
  "exclude": ["**/*.generated.ts", "**/*.test.ts"],
  "files": [
    { "source": "demo/components/banking.ts",
      "url":    "/dist/demo/components/banking.js" }
  ]
}
```

The browser then does `await Promise.all(files.map(f => import(f.url)))`
and the component classes register themselves. Adding a new file under
`demo/components/` causes the next request to `/api/components` to
include it — no source edits required.

### Programmatic API

For non-CLI integrations, everything is exported from
`sigil/discovery`:

```ts
import {
  findConfig, loadConfig,
  resolveComponentFiles, writeComponentBarrel,
  describeComponentFiles,
  runDiscovery, getRegisteredComponents,
  ConfigError
} from "sigil/discovery";
```

`sigil/discovery` pulls in `node:fs` — keep it out of browser bundles.

## Real LLM agent (Claude)

The dev server ships a thin proxy that takes the prompt + manifest from
the browser, forwards it to Anthropic's Messages API, and returns the
result. The **`ANTHROPIC_API_KEY` environment variable is required** — if
unset, the `/api/agent` endpoint refuses to call upstream and the demo's
"Claude" toggle stays disabled.

### Setup

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-…"      # PowerShell
npm run dev
```

```bash
export ANTHROPIC_API_KEY=sk-ant-…        # bash / zsh
npm run dev
```

The startup banner prints whether the key was found:

```
[sigil-dev] http://localhost:5173/demo/
[sigil-dev]   GET  /api/components     → runtime component discovery
[sigil-dev]   GET  /api/agent/status   → reports whether ANTHROPIC_API_KEY is set
[sigil-dev]   POST /api/agent          → proxy to Anthropic Messages API (key: set)
```

Without the key the last line says `(key: MISSING)` plus an instructional
hint, and the demo shows a yellow banner under the topbar pointing the
user to this section.

### Endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/agent/status` | — | `{ keyConfigured, model, help? }` |
| POST | `/api/agent` | `{ prompt, systemPrompt, model?, maxTokens? }` | `{ text, model, stopReason, usage }` |

Key behavior:
- **Key required.** `POST /api/agent` returns `503` with `{ error, help }` if
  the env var is not set. The browser surfaces both.
- **System prompt comes from the browser.** The demo's manifest is the
  source of truth; the server stays a generic proxy.
- **Prompt caching enabled.** The system prompt block is sent with
  `cache_control: { type: "ephemeral" }`. Subsequent requests in a session
  hit Anthropic's prompt cache; the demo shows `cache hit N` chips on the
  message when the response's `usage.cache_read_input_tokens > 0`.
- **Defaults.** Model `claude-sonnet-4-6` (override with `SIGIL_MODEL`
  env var or per-request `model`). Max tokens 4096 (capped at 8192). 60s
  timeout with `AbortController`.

### Demo UI

The topbar has a two-button segmented control: **Fake agent** /
**Claude `<model>`**. The Claude button is disabled when the status
endpoint reports `keyConfigured: false`. When enabled and selected, the
status line above the prompt input shows what's wired up:

> Using Claude (`claude-sonnet-4-6`) via `/api/agent`. The manifest above
> is sent as the system prompt with prompt caching enabled.

Each agent reply gets badges showing the model, input/output token
counts, and (when applicable) the cached-token count, so the cache
behaviour is visible without opening devtools.

### What happens to the LLM's response

The browser receives the raw `text` from `/api/agent`, runs it through
`extractJsonEnvelope()` (strips ` ```json ` fences and trailing prose),
then feeds the result into `Sigil.parse()`. If parsing fails the message
is shown as plain text; if it succeeds each node is `Sigil.validate()`d
against the manifest just like a fake-agent response.

### Programmatic use

If you want to call the proxy from your own code:

```ts
import type { AgentRequestBody, AgentReplyBody } from "sigil/dev-server";

const reply = await fetch("/api/agent", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    prompt: "Show me my portfolio",
    systemPrompt: Sigil.buildSystemPrompt({ budget: "minimal" })
  } satisfies AgentRequestBody)
}).then((r) => r.json() as Promise<AgentReplyBody>);

const parsed = Sigil.parse(reply.text);
```

The browser-side helpers `callRealAgent`, `fetchAgentStatus`,
`extractJsonEnvelope`, and `RealAgentError` live in `demo/real-agent.ts`
— copy them or import them if your own app wants the same flow.

## The finance demo

`demo/` is an extensive showcase: 21 web components (20 finance + a
design-token swatch), 12 scripted scenarios, a fake agent that
pattern-matches prompts to JSON responses, a DTCG token set mounted at
boot, a live manifest panel that surfaces the token catalog in the system
prompt, and a runtime-discovery panel that shows the live config + matched
files.

Components are grouped:

| File | Components |
|---|---|
| `demo/components/market.ts` | `stock-quote`, `market-mover`, `news-headline`, `currency-rate` |
| `demo/components/portfolio.ts` | `portfolio-summary`, `holdings-table`, `kpi-card`, `chart-bars` |
| `demo/components/banking.ts` | `account-balance`, `transaction-list`, `budget-bar`, `invoice-card` |
| `demo/components/credit.ts` | `credit-score`, `loan-summary`, `refinance-option` |
| `demo/components/trading.ts` | `trade-confirmation`, `alert-banner`, `forecast-card`, `order-book`, `watch-list` |
| `demo/components/theme.ts` | `theme-swatch` (demonstrates a `type: "token"` color prop) |

Each component extends `AgentElement` (in `demo/element.ts`) — a small
base that schedules a microtask render whenever a `@reactive accessor`
field changes. Together with `@reactive` (in `demo/reactive.ts`) this
gives clean reactive setters without per-property boilerplate:

```ts
@agent("Compact KPI tile: label, big value, optional delta percent.")
@tag("kpi-card")
export class KpiCardElement extends AgentElement {
  @prop("Metric label", { type: "string", required: true })
  @reactive accessor label = "";

  @prop("Display value", { type: "string", required: true })
  @reactive accessor value = "";

  @prop("Force tone", { values: ["up", "down", "flat", "neutral"] })
  @reactive accessor tone: KpiTone = "neutral";

  protected override template(): string {
    return `<article class="card kpi-card trend-${this.tone}">…</article>`;
  }
}
```

`AgentElement` and `@reactive` are demo-side utilities, not part of the
framework — copy them to your own project or use whatever rendering layer
you already have. The framework only cares that the class extends
`HTMLElement` and is decorated.

## Scripts

| Command | What |
|---|---|
| `npm run build` | `tsc` → `dist/`. Emits JS, `.d.ts`, sourcemaps, declaration maps. |
| `npm run dev` | tsc once, then tsc --watch + HTTP dev server on `:5173`. |
| `npm run gen:components` | Run the codegen CLI against `./sigil.config.ts`. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm test` | Run all tests via tsx. |
| `npm run test:built` | Build first, then run compiled tests with `node --test`. |
| `npm run clean` | Delete `dist/`. |

## Testing

Runs via `node --import tsx --test`. 25 tests across five files:

| File | Coverage |
|---|---|
| `test/core.test.ts` | Real stage-3 decorator syntax: `@agent`/`@tag`/`@prop`/`@slot` registration, manifest shorthand, parse + validate semantics, system prompt content. |
| `test/demo-smoke.test.ts` | All 21 demo components register; every scripted scenario JSON validates against the registry; manifests are populated at class-definition time (no instances needed). |
| `test/discovery.test.ts` | `defineConfig` identity; glob expansion + exclude; deterministic POSIX-import barrel; missing-config error; both `runDiscovery` modes. |
| `test/dev-server.test.ts` | `toUrl` mapping (source `.ts` → `/dist/...js`); `/api/components` returns glob mode + URLs, registry mode, and 400 on missing config. |
| `test/tokens.test.ts` | DTCG load/flatten/alias resolution, `toCss` emission, manifest shorthand for token props, validator behaviour (known/unknown/literal/wrong-group), system-prompt token catalog. |

`test:built` round-trips through the compiler — useful for catching emit
bugs that wouldn't appear when running TS directly via tsx.

## Project structure

```
.
├── sigil.config.ts           # demo config (glob discovery)
├── tsconfig.json             # strict, NodeNext ESM, ES2022 target
├── package.json              # bin: sigil, sigil-dev
│
├── src/                      # framework
│   ├── index.ts              #   barrel
│   ├── polyfills.ts          #   Symbol.metadata
│   ├── types.ts              #   PropDecl, UINode, ValidationError, etc.
│   ├── state.ts              #   class-meta WeakMaps + metadata key bags
│   ├── utils.ts              #   inferPropShape, buildPropDecl, isValidCustomElementTag
│   ├── decorators.ts         #   @tag, @prop, @slot, @agent
│   ├── registry.ts           #   ComponentRegistryImpl + manifest formatters
│   ├── runtime.ts            #   parseResponse, validateNode, Sigil
│   ├── renderer.ts           #   SigilRenderer (with token resolution)
│   ├── tokens.ts             #   DesignTokensImpl (DTCG loader + CSS emit)
│   ├── config.ts             #   SigilConfig, defineConfig
│   └── discovery.ts          #   findConfig, runDiscovery, describeComponentFiles
│
├── scripts/                  # CLIs
│   ├── gen-components.ts     #   sigil gen
│   └── dev-server.ts         #   sigil-dev
│
├── demo/                     # finance demo
│   ├── index.html
│   ├── styles.css
│   ├── app.ts                #   bootstrap: fetch /api/components → dynamic import → render UI
│   ├── element.ts            #   AgentElement reactive base class
│   ├── reactive.ts           #   @reactive accessor decorator
│   ├── format.ts             #   money/pct formatters, escapeHtml
│   ├── spark.ts              #   sparkline path builder
│   ├── types.ts              #   demo prop shapes (WatchlistItem, etc.)
│   ├── tokens.ts             #   DTCG token set loaded at boot
│   ├── fake-agent.ts         #   typed scenarios + pattern matcher
│   └── components/           #   21 components in 6 files (incl. theme-swatch)
│
└── test/                     # 25 tests via tsx
    ├── core.test.ts
    ├── demo-smoke.test.ts
    ├── discovery.test.ts
    ├── dev-server.test.ts
    └── tokens.test.ts
```

## Package exports

| Subpath | Purpose | Pulls in `node:*`? |
|---|---|---|
| `sigil` | Runtime: decorators, registry, runtime, renderer, tokens, types. | No — browser-safe. |
| `sigil/config` | `defineConfig` + config types. | No. |
| `sigil/discovery` | `runDiscovery`, glob expansion, barrel writer, config loader. | Yes — Node only. |

## Notes & limitations

- **Custom-element tag spec** — tags MUST contain a hyphen. The
  `isValidCustomElementTag` check rejects e.g. `watchlist` (use
  `watch-list`). The old JS version of the demo bypassed this through a
  manual register call; the proper `@tag` decorator catches it.
- **Stage 3 decorators** — TypeScript 5+ syntax. `Symbol.metadata` is
  polyfilled (`src/polyfills.ts`) on import. Field/accessor decorator
  metadata is the mechanism the framework uses to populate `meta.props`
  at class-definition time without needing an instance.
- **No bundler in this repo** — `tsc` builds, the dev server serves
  `dist/`. Production consumers are expected to bring their own bundler
  (Vite, esbuild, Rollup); the codegen barrel (`sigil gen`) is the
  bundle-friendly entry point.
- **The fake agent in the demo is deterministic** — pattern matches a
  prompt to a scripted JSON response. Swap it out for a real LLM call
  (Anthropic Messages API, OpenAI Chat Completions, etc.) by feeding
  `Sigil.buildSystemPrompt()` as the system message and parsing
  the response through `Sigil.parse`.

## License

See `LICENSE`.
