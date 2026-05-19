import {
  Sigil,
  SigilRenderer,
  ComponentRegistry,
  DesignTokens,
  type ManifestBudget,
  type ParseResult,
  type UINode
} from "../src/index.js";
import { fakeAgent, runScenarioById, type AgentResponse } from "./fake-agent.js";
import { escapeHtml } from "./format.js";
import { demoTokens } from "./tokens.js";
import {
  callRealAgent,
  extractJsonEnvelope,
  fetchAgentStatus,
  RealAgentError,
  type AgentResult,
  type AgentStatus
} from "./real-agent.js";
import { highlightJson } from "./highlight.js";
import { buildAgentSystemPrompt } from "./agent-prompt.js";

DesignTokens.load(demoTokens);
DesignTokens.mountStyles();

type AgentSource = "fake" | "real";

interface AppElements {
  readonly componentCount: HTMLElement;
  readonly tokenCount: HTMLElement;
  readonly manifestBudgetReadout: HTMLElement;
  readonly agentMetaLine: HTMLElement;
  readonly agentToggle: HTMLElement;
  readonly keyBanner: HTMLElement;
  readonly chips: HTMLElement;
  readonly promptInput: HTMLInputElement;
  readonly promptForm: HTMLFormElement;
  readonly agentStatusLine: HTMLElement;
  readonly jsonPane: HTMLElement;
  readonly renderPane: HTMLElement;
  readonly renderCount: HTMLElement;
  readonly jsonStat: HTMLElement;
  readonly renderStat: HTMLElement;
  readonly scenarioLabel: HTMLElement;
  readonly footStat: HTMLElement;
  readonly footValidated: HTMLElement;
  readonly footMeta: HTMLElement;
  readonly budgetPills: HTMLElement;
  readonly manifestText: HTMLElement;
  readonly manifestSize: HTMLElement;
  readonly manifestTokens: HTMLElement;
  readonly discoveryPanel: HTMLElement;
}

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing DOM node: #${id}`);
  return found as T;
}

const els: AppElements = {
  componentCount: el<HTMLElement>("component-count"),
  tokenCount: el<HTMLElement>("token-count"),
  manifestBudgetReadout: el<HTMLElement>("manifest-budget-readout"),
  agentMetaLine: el<HTMLElement>("agent-meta-line"),
  agentToggle: el<HTMLElement>("agent-source-toggle"),
  keyBanner: el<HTMLElement>("key-banner"),
  chips: el<HTMLElement>("chips"),
  promptInput: el<HTMLInputElement>("prompt-input"),
  promptForm: el<HTMLFormElement>("prompt-form"),
  agentStatusLine: el<HTMLElement>("agent-status"),
  jsonPane: el<HTMLElement>("json-pane"),
  renderPane: el<HTMLElement>("render-pane"),
  renderCount: el<HTMLElement>("render-count"),
  jsonStat: el<HTMLElement>("json-stat"),
  renderStat: el<HTMLElement>("render-stat"),
  scenarioLabel: el<HTMLElement>("scenario-label"),
  footStat: el<HTMLElement>("foot-stat"),
  footValidated: el<HTMLElement>("foot-validated"),
  footMeta: el<HTMLElement>("foot-meta"),
  budgetPills: el<HTMLElement>("budget-pills"),
  manifestText: el<HTMLElement>("manifest-text"),
  manifestSize: el<HTMLElement>("manifest-size"),
  manifestTokens: el<HTMLElement>("manifest-tokens"),
  discoveryPanel: el<HTMLElement>("discovery-panel")
};

let currentSource: AgentSource = "fake";
let agentStatus: AgentStatus = { keyConfigured: false, model: "claude-sonnet-4-6" };
let currentBudget: ManifestBudget = "minimal";

interface DiscoveryResponse {
  readonly configPath: string;
  readonly mode: "glob" | "registry";
  readonly include: readonly string[];
  readonly exclude: readonly string[];
  readonly files: readonly { source: string; url: string }[];
}

async function discoverComponents(): Promise<DiscoveryResponse> {
  const response = await fetch("/api/components");
  if (!response.ok) {
    throw new Error(`Discovery failed: ${response.status} ${await response.text()}`);
  }
  const body = (await response.json()) as DiscoveryResponse;
  await Promise.all(body.files.map((file) => import(/* @vite-ignore */ file.url)));
  return body;
}

function renderDiscoveryPanel(info: DiscoveryResponse): void {
  const items = info.files.map((f) => `<li><code>${escapeHtml(f.source)}</code></li>`).join("");
  const includeChips = info.include.map((g) => `<code>${escapeHtml(g)}</code>`).join(" ");
  const excludeChips = info.exclude.length
    ? info.exclude.map((g) => `<code>${escapeHtml(g)}</code>`).join(" ")
    : `<span class="muted">none</span>`;
  els.discoveryPanel.innerHTML = `
    <header>
      <h3>Resolved via ${escapeHtml(info.mode)}</h3>
      <span class="badge-good">${info.mode}</span>
    </header>
    <dl class="discovery-meta">
      <dt>Config</dt><dd><code>${escapeHtml(info.configPath)}</code></dd>
      <dt>Include</dt><dd>${includeChips || `<span class="muted">none</span>`}</dd>
      <dt>Exclude</dt><dd>${excludeChips}</dd>
      <dt>Resolved</dt><dd>${info.files.length} file${info.files.length === 1 ? "" : "s"}</dd>
    </dl>
    <ul class="discovery-list">${items}</ul>
  `;
}

function renderAgentSourceToggle(): void {
  const real = agentStatus.keyConfigured;
  els.agentToggle.innerHTML = `
    <button type="button" class="src-btn ${currentSource === "fake" ? "active" : ""}" data-source="fake" role="tab" aria-selected="${currentSource === "fake"}">Fake</button>
    <button type="button" class="src-btn ${currentSource === "real" ? "active" : ""}" data-source="real" role="tab" aria-selected="${currentSource === "real"}" ${real ? "" : "disabled"} title="${real ? "" : "Set ANTHROPIC_API_KEY to enable"}">
      Claude <span class="model-chip">${escapeHtml(agentStatus.model)}</span>
    </button>
  `;
  for (const btn of els.agentToggle.querySelectorAll<HTMLButtonElement>(".src-btn")) {
    btn.addEventListener("click", () => {
      const next = btn.dataset.source as AgentSource;
      if (next === currentSource) return;
      if (next === "real" && !agentStatus.keyConfigured) return;
      currentSource = next;
      renderAgentSourceToggle();
      renderAgentStatusLine();
      renderAgentMetaLine();
    });
  }
}

function renderAgentMetaLine(): void {
  els.agentMetaLine.textContent = currentSource === "fake" ? "fake" : agentStatus.model;
}

function renderAgentStatusLine(): void {
  if (currentSource === "fake") {
    els.agentStatusLine.innerHTML = `Routing through <strong>fake agent</strong> — deterministic, no network. Toggle <strong>Claude</strong> in the header to use the real model.`;
    return;
  }
  els.agentStatusLine.innerHTML = `Routing through <strong>Claude</strong> (<code>${escapeHtml(agentStatus.model)}</code>) via <code>/api/agent</code>. Prompt caching enabled on the system prompt.`;
}

function renderKeyBanner(status: AgentStatus): void {
  if (status.keyConfigured) {
    els.keyBanner.innerHTML = "";
    return;
  }
  els.keyBanner.innerHTML = `
    <div class="alert-banner sev-warning">
      <div class="alert-icon">!</div>
      <div class="alert-body">
        <strong>Real agent disabled — ANTHROPIC_API_KEY not set</strong>
        <p>${escapeHtml(status.help ?? "Set ANTHROPIC_API_KEY in the dev server's environment and restart npm run dev.")}</p>
      </div>
    </div>
  `;
}

function refreshManifest(): void {
  const prompt = Sigil.buildSystemPrompt({ budget: currentBudget });
  els.manifestText.textContent = prompt;
  els.manifestSize.textContent = `${prompt.length} chars`;
  els.manifestTokens.textContent = `~${Math.ceil(prompt.length / 4)} tokens`;
  els.manifestBudgetReadout.textContent = currentBudget;
}

function currentSystemPrompt(): string {
  return Sigil.buildSystemPrompt({ budget: currentBudget });
}

interface ScenarioMeta {
  readonly id: string;
  readonly label: string;
  readonly prompt: string;
  readonly index: number;
}

const FEATURED_SCENARIOS: readonly ScenarioMeta[] = [
  { id: "quote",     label: "Show me NVDA",        prompt: "Show me NVDA — price, today's change, and a chart.", index: 1 },
  { id: "movers",    label: "Top movers today",    prompt: "What are the top movers in tech today?",             index: 2 },
  { id: "portfolio", label: "My portfolio",        prompt: "Give me an overview of my portfolio.",               index: 3 },
  { id: "trade",     label: "Confirm a buy order", prompt: "I want to buy 20 shares of NVDA at $948 limit.",     index: 4 },
  { id: "credit",    label: "Credit score check",  prompt: "How's my credit looking? Any offers?",               index: 5 }
];

const TOTAL_SCENARIOS = FEATURED_SCENARIOS.length;

function pad2(n: number): string { return n.toString().padStart(2, "0"); }

const FREESTYLE_ID = "freestyle";
const FREESTYLE_INDEX = TOTAL_SCENARIOS + 1;

function populateChips(): void {
  const scenarioChips = FEATURED_SCENARIOS.map((s, i) => `
    <button type="button" class="chip ${i === 0 ? "active" : ""}" data-id="${escapeHtml(s.id)}" data-prompt="${escapeHtml(s.prompt)}" data-index="${s.index}">
      <span class="ix">${pad2(s.index)}</span>${escapeHtml(s.label)}
    </button>
  `).join("");
  const freestyleChip = `
    <button type="button" class="chip chip-freestyle" data-id="${FREESTYLE_ID}" data-index="${FREESTYLE_INDEX}">
      <span class="ix">${pad2(FREESTYLE_INDEX)}</span>Freestyle
    </button>
  `;
  els.chips.innerHTML = scenarioChips + freestyleChip;
  for (const btn of els.chips.querySelectorAll<HTMLButtonElement>(".chip")) {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id ?? "";
      if (id === FREESTYLE_ID) {
        enterFreestyleMode();
        return;
      }
      const promptText = btn.dataset.prompt ?? "";
      const index = Number(btn.dataset.index ?? "1");
      els.promptInput.value = promptText;
      void runScenario(id, index);
    });
  }
}

function enterFreestyleMode(): void {
  setActiveChip(FREESTYLE_ID);
  els.promptInput.value = "";
  els.jsonPane.innerHTML = `<div class="pane-empty">Awaiting prompt — type anything below to see the agent's raw JSON envelope here.</div>`;
  els.renderPane.innerHTML = `<div class="pane-empty">Blank canvas. Whatever the agent emits will render here, validated against the live component registry.</div>`;
  els.renderCount.textContent = "0 elements";
  els.jsonStat.textContent = "freestyle · awaiting prompt";
  els.renderStat.textContent = "no UI yet";
  setFoot(true, "freestyle mode", null, "freestyle");
  els.promptInput.focus();
}

function setActiveChip(id: string | null): void {
  for (const btn of els.chips.querySelectorAll<HTMLButtonElement>(".chip")) {
    btn.classList.toggle("active", btn.dataset.id === id);
  }
}

function fadePanes(): Promise<void> {
  els.jsonPane.classList.add("fading");
  els.renderPane.classList.add("fading");
  return new Promise((resolve) => setTimeout(resolve, 140));
}

function unfadePanes(): void {
  els.jsonPane.classList.remove("fading");
  els.renderPane.classList.remove("fading");
}

function setFoot(passed: boolean, message: string, scenarioIndex: number | null, scenarioId?: string): void {
  els.footStat.textContent = message;
  els.footValidated.textContent = passed ? "validated against registry" : "validation issues — see render pane";
  els.footValidated.style.color = passed ? "" : "var(--color-state-down)";
  if (scenarioIndex !== null) {
    els.scenarioLabel.textContent = `scenario ${pad2(scenarioIndex)} of ${pad2(TOTAL_SCENARIOS)}`;
    els.footMeta.textContent = `scenario ${pad2(scenarioIndex)} of ${pad2(TOTAL_SCENARIOS)}${scenarioId ? ` · ${scenarioId}` : ""}`;
  } else {
    els.scenarioLabel.textContent = scenarioId ? `freeform · ${scenarioId}` : "freeform";
    els.footMeta.textContent = scenarioId ? `freeform · matched ${scenarioId}` : "freeform";
  }
}

interface RenderOptions {
  scenarioId: string | null;
  scenarioIndex: number | null;
  sourceLabel: string;
  durationMs: number;
}

function safelyPretty(json: string): string {
  try { return JSON.stringify(JSON.parse(json), null, 2); } catch { return json; }
}

function renderPayload(payload: AgentResponse | string, opts: RenderOptions): void {
  const isString = typeof payload === "string";
  const candidate = isString ? extractJsonEnvelope(payload) : JSON.stringify(payload);
  const parsed: ParseResult = Sigil.parse(candidate);

  if (parsed.type === "text") {
    els.jsonPane.innerHTML = highlightJson(isString ? payload : JSON.stringify(payload, null, 2));
    els.renderPane.innerHTML = `<div class="render-pane-error">Agent reply is plain text, no components to render.</div>`;
    els.renderCount.textContent = "0 elements";
    els.jsonStat.textContent = `parsed as text · ${opts.durationMs.toFixed(1)}ms`;
    els.renderStat.textContent = "no UI";
    setFoot(false, "0 nodes parsed", opts.scenarioIndex, opts.scenarioId ?? undefined);
    return;
  }

  const errors: string[] = [];
  for (const node of parsed.nodes) {
    const result = Sigil.validate(node);
    for (const e of result.errors) {
      errors.push(`${node.component}.${e.prop}: ${e.message}`);
    }
  }
  const valid = errors.length === 0;
  const nodeCount = parsed.nodes.length;

  const displayJson = isString ? safelyPretty(candidate) : JSON.stringify(payload, null, 2);
  els.jsonPane.innerHTML = highlightJson(displayJson);
  els.jsonStat.textContent = `parsed in ${opts.durationMs.toFixed(1)}ms · ${opts.sourceLabel}`;
  els.renderCount.textContent = `${nodeCount} element${nodeCount === 1 ? "" : "s"}`;
  els.renderStat.textContent = valid ? "validated ✓" : `${errors.length} issue${errors.length === 1 ? "" : "s"}`;

  els.renderPane.innerHTML = "";
  if (!valid) {
    const list = document.createElement("ul");
    list.className = "validation-list";
    for (const e of errors) {
      const li = document.createElement("li");
      li.textContent = e;
      list.appendChild(li);
    }
    els.renderPane.appendChild(list);
  }
  const renderer = new SigilRenderer(els.renderPane);
  renderer.render(parsed.nodes as readonly UINode[]);

  setFoot(valid, `${nodeCount} node${nodeCount === 1 ? "" : "s"} parsed · ${errors.length} error${errors.length === 1 ? "" : "s"}`, opts.scenarioIndex, opts.scenarioId ?? undefined);
}

function renderAgentError(err: Error): void {
  const help = err instanceof RealAgentError && err.help ? err.help : "";
  const status = err instanceof RealAgentError ? err.status : 0;
  els.jsonPane.innerHTML = highlightJson({ error: err.message, status, help: help || undefined });
  els.renderPane.innerHTML = `
    <div class="alert-banner sev-danger">
      <div class="alert-icon">!</div>
      <div class="alert-body">
        <strong>${escapeHtml(err.message)}</strong>
        ${help ? `<p>${escapeHtml(help)}</p>` : ""}
      </div>
    </div>
  `;
  els.jsonStat.textContent = `error ${status || ""}`.trim();
  els.renderStat.textContent = "no UI";
  els.renderCount.textContent = "0 elements";
  setFoot(false, "0 nodes parsed", null, "error");
}

async function runScenario(id: string, index: number): Promise<void> {
  setActiveChip(id);
  await fadePanes();
  const start = performance.now();
  const payload = runScenarioById(id) ?? { components: [] };
  const duration = performance.now() - start;
  renderPayload(payload, { scenarioId: id, scenarioIndex: index, sourceLabel: "scripted", durationMs: duration });
  unfadePanes();
}

function isFreestyleActive(): boolean {
  return els.chips.querySelector<HTMLButtonElement>(".chip.active")?.dataset.id === FREESTYLE_ID;
}

async function runFreeformPrompt(text: string): Promise<void> {
  const freestyle = isFreestyleActive();
  await fadePanes();

  if (currentSource === "fake") {
    const start = performance.now();
    const payload = await fakeAgent(text);
    const duration = performance.now() - start;
    const matched = matchScenarioId(text);
    if (freestyle) setActiveChip(FREESTYLE_ID);
    else setActiveChip(matched);
    renderPayload(payload, {
      scenarioId: freestyle ? null : matched,
      scenarioIndex: freestyle ? null : scenarioIndexFor(matched),
      sourceLabel: freestyle ? "freestyle · fake agent" : "fake agent",
      durationMs: duration
    });
    unfadePanes();
    return;
  }

  if (freestyle) setActiveChip(FREESTYLE_ID);
  else setActiveChip(null);
  try {
    const start = performance.now();
    const result: AgentResult = await callRealAgent({
      prompt: text,
      systemPrompt: buildAgentSystemPrompt()
    });
    const duration = performance.now() - start;
    const cacheLabel = result.usage.cache_read_input_tokens
      ? ` · cache ${result.usage.cache_read_input_tokens}`
      : "";
    renderPayload(result.text, {
      scenarioId: null,
      scenarioIndex: null,
      sourceLabel: `Claude · ${result.model} · in ${result.usage.input_tokens} / out ${result.usage.output_tokens}${cacheLabel}`,
      durationMs: duration
    });
    unfadePanes();
  } catch (err) {
    renderAgentError(err as Error);
    unfadePanes();
  }
}

function matchScenarioId(text: string): string {
  const t = text.toLowerCase();
  if (/\b(buy|sell|order|trade|confirm)\b/.test(t)) return "trade";
  if (/\b(credit|refinanc|apr|loan)\b/.test(t)) return "credit";
  if (/\b(portfolio|holding|allocation|positions?)\b/.test(t)) return "portfolio";
  if (/\b(mover|gainers?|losers?|top.*today)\b/.test(t)) return "movers";
  if (/\b(quote|price|ticker|stock|nvda|aapl|msft|tsla)\b/.test(t)) return "quote";
  return "quote";
}

function scenarioIndexFor(id: string): number | null {
  const s = FEATURED_SCENARIOS.find((sc) => sc.id === id);
  return s ? s.index : null;
}

function wireBudgetPills(): void {
  for (const pill of els.budgetPills.querySelectorAll<HTMLButtonElement>(".pill")) {
    pill.addEventListener("click", () => {
      const budget = pill.dataset.budget as ManifestBudget | undefined;
      if (!budget || budget === currentBudget) return;
      currentBudget = budget;
      for (const p of els.budgetPills.querySelectorAll<HTMLButtonElement>(".pill")) {
        p.classList.toggle("active", p === pill);
      }
      refreshManifest();
    });
  }
}

function wireCopyButtons(): void {
  for (const btn of document.querySelectorAll<HTMLButtonElement>(".cmd .copy")) {
    btn.addEventListener("click", () => {
      const text = btn.dataset.copy ?? "";
      if (!text || !navigator.clipboard) return;
      void navigator.clipboard.writeText(text).then(() => {
        const original = btn.textContent ?? "Copy";
        btn.textContent = "Copied";
        btn.classList.add("copied");
        setTimeout(() => {
          btn.textContent = original;
          btn.classList.remove("copied");
        }, 1200);
      });
    });
  }
}

function showFatalError(message: string): void {
  els.renderPane.innerHTML = `
    <div class="alert-banner sev-danger">
      <div class="alert-icon">!</div>
      <div class="alert-body">
        <strong>Discovery failed</strong>
        <p>${escapeHtml(message)}</p>
      </div>
    </div>
  `;
  els.jsonPane.innerHTML = highlightJson({ error: message });
}

async function bootstrap(): Promise<void> {
  els.componentCount.textContent = "…";
  els.tokenCount.textContent = "…";
  els.manifestText.textContent = "Discovering components…";

  let info: DiscoveryResponse;
  try {
    info = await discoverComponents();
  } catch (err) {
    showFatalError((err as Error).message);
    throw err;
  }

  try {
    agentStatus = await fetchAgentStatus();
  } catch {
    agentStatus = { keyConfigured: false, model: "claude-sonnet-4-6" };
  }

  renderDiscoveryPanel(info);
  renderKeyBanner(agentStatus);
  renderAgentSourceToggle();
  renderAgentStatusLine();
  renderAgentMetaLine();

  els.componentCount.textContent = String(ComponentRegistry.size);
  els.tokenCount.textContent = String(DesignTokens.size);
  populateChips();
  refreshManifest();
  wireBudgetPills();
  wireCopyButtons();

  els.promptForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = els.promptInput.value.trim();
    if (!value) return;
    void runFreeformPrompt(value);
  });

  const first = FEATURED_SCENARIOS[0]!;
  await runScenario(first.id, first.index);
  els.promptInput.value = first.prompt;
}

await bootstrap();
