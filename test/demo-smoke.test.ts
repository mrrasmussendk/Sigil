import test from "node:test";
import assert from "node:assert/strict";

/**
 * Stub the bare minimum of the DOM API the framework + demo components
 * need at module-load time. Components only register themselves; we never
 * actually render in Node.
 */
class FakeHTMLElement {
  innerHTML: string = "";
  isConnected: boolean = false;
  connectedCallback?(): void;
  requestRender(): void {
    /* no-op in test */
  }
}

interface CustomElementRegistryLike {
  define(name: string, ctor: CustomElementConstructor): void;
  get(name: string): CustomElementConstructor | undefined;
}

const fakeRegistry = {
  map: new Map<string, CustomElementConstructor>(),
  define(name, ctor) { this.map.set(name, ctor); },
  get(name) { return this.map.get(name); }
} satisfies CustomElementRegistryLike & { map: Map<string, CustomElementConstructor> };

(globalThis as unknown as { HTMLElement: typeof FakeHTMLElement }).HTMLElement = FakeHTMLElement;
(globalThis as unknown as { customElements: CustomElementRegistryLike }).customElements = fakeRegistry;
(globalThis as unknown as { queueMicrotask: typeof queueMicrotask }).queueMicrotask = queueMicrotask;

const { ComponentRegistry, Sigil } = await import("../src/index.js");
await import("../demo/components/market.js");
await import("../demo/components/portfolio.js");
await import("../demo/components/banking.js");
await import("../demo/components/credit.js");
await import("../demo/components/trading.js");
await import("../demo/components/theme.js");
const { listScenarios, runScenarioById } = await import("../demo/fake-agent.js");

const EXPECTED_COMPONENTS = [
  "stock-quote", "market-mover", "news-headline", "currency-rate",
  "portfolio-summary", "holdings-table", "kpi-card", "chart-bars",
  "account-balance", "transaction-list", "budget-bar", "invoice-card",
  "credit-score", "loan-summary", "refinance-option",
  "trade-confirmation", "alert-banner", "forecast-card", "order-book", "watch-list",
  "theme-swatch"
] as const;

test("demo registers all finance components", () => {
  const tags = ComponentRegistry.getAll().map((d) => d.tag);
  for (const expected of EXPECTED_COMPONENTS) {
    assert.ok(tags.includes(expected), `Missing component: ${expected}`);
  }
});

test("manifest is fully populated at class-definition time (no instances needed)", () => {
  const minimal = ComponentRegistry.getManifest({ budget: "minimal" });
  // Spot-check a few props that should appear in the minimal manifest
  assert.match(minimal, /stock-quote\(.*ticker:str!.*\)/);
  assert.match(minimal, /budget-bar\(.*spent:float!.*budget:float!.*\)/);
  assert.match(minimal, /credit-score\(.*score:float!.*\)/);
});

test("every scenario produces JSON that parses and validates against the registry", () => {
  const scenarios = listScenarios();
  assert.ok(scenarios.length >= 10, "Expected at least 10 scenarios");
  for (const { id } of scenarios) {
    const payload = runScenarioById(id);
    assert.ok(payload, `Scenario ${id} returned null`);
    const parsed = Sigil.parse(JSON.stringify(payload));
    assert.equal(parsed.type, "ui", `Scenario ${id} did not parse as UI`);
    if (parsed.type !== "ui") return;
    for (const node of parsed.nodes) {
      const result = Sigil.validate(node);
      const errors = result.errors.filter((e) => e.severity === "error");
      assert.equal(
        errors.length,
        0,
        `Scenario ${id} component ${node.component} has validation errors: ${JSON.stringify(errors)}`
      );
    }
  }
});

test("manifest budgets all produce non-empty output", () => {
  for (const budget of ["minimal", "standard", "full"] as const) {
    const out = Sigil.buildSystemPrompt({ budget });
    assert.ok(out.length > 100, `Budget ${budget} produced output of length ${out.length}`);
  }
});
