import test from "node:test";
import assert from "node:assert/strict";

class FakeHTMLElement {}

interface CustomElementRegistryLike {
  define(name: string, ctor: CustomElementConstructor): void;
  get(name: string): CustomElementConstructor | undefined;
}

const fakeRegistry = {
  map: new Map<string, CustomElementConstructor>(),
  define(name: string, ctor: CustomElementConstructor): void {
    this.map.set(name, ctor);
  },
  get(name: string): CustomElementConstructor | undefined {
    return this.map.get(name);
  }
} satisfies CustomElementRegistryLike & { map: Map<string, CustomElementConstructor> };

(globalThis as unknown as { HTMLElement: typeof FakeHTMLElement }).HTMLElement = FakeHTMLElement;
(globalThis as unknown as { customElements: CustomElementRegistryLike }).customElements = fakeRegistry;

const { agent, prop, slot, tag, ComponentRegistry, Sigil } = await import("../src/index.js");

type Outcome = "upheld" | "dismissed" | "partial";

@agent("Verdict summary card")
@tag("verdict-card")
class VerdictCard extends FakeHTMLElement {
  @prop("Title", { type: "string", required: true })
  accessor title: string = "";

  @prop("Outcome", { values: ["upheld", "dismissed", "partial"], required: true })
  accessor outcome: Outcome = "upheld";

  @slot("Footer")
  accessor footerSlot: string = "";
}

test("decorators register component and props/slots", () => {
  const declaration = ComponentRegistry.get("verdict-card");
  assert.ok(declaration, "declaration should be registered");
  assert.equal(declaration.tag, "verdict-card");

  const title = declaration.props.title;
  assert.ok(title);
  assert.equal(title.type, "string");
  assert.equal(title.required, true);

  const outcome = declaration.props.outcome;
  assert.ok(outcome);
  assert.equal(outcome.type, "enum");
  if (outcome.type !== "enum") throw new Error("type narrowing failed");
  assert.deepEqual([...outcome.values], ["upheld", "dismissed", "partial"]);
  assert.equal(outcome.required, true);

  assert.ok(declaration.slots.footer);

  assert.ok(fakeRegistry.map.get("verdict-card"));

  // Confirm a constructed instance doesn't break anything
  new VerdictCard();
});

test("minimal manifest includes shorthands and required flag", () => {
  const manifest = ComponentRegistry.getManifest({ budget: "minimal" });
  assert.match(manifest, /verdict-card\(title:str!, outcome:upheld\|dismissed\|partial!\)/);
});

test("runtime parse and validate enforce required/enum/min-max", () => {
  const parsed = Sigil.parse('{"component":"verdict-card","props":{"title":"Case","outcome":"upheld"}}');
  assert.equal(parsed.type, "ui");
  if (parsed.type !== "ui") throw new Error("expected ui parse");
  const first = parsed.nodes[0];
  assert.ok(first);
  const valid = Sigil.validate(first);
  assert.equal(valid.valid, true);

  const bad = Sigil.validate({
    component: "verdict-card",
    props: { outcome: "invalid", extra: 1 }
  });
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.some((e) => e.prop === "title" && e.severity === "error"));
  assert.ok(bad.errors.some((e) => e.prop === "outcome" && e.severity === "error"));
  assert.ok(bad.errors.some((e) => e.prop === "extra" && e.severity === "warning"));
});

test("system prompt buildSystemPrompt produces non-empty output for all budgets", () => {
  for (const budget of ["minimal", "standard", "full"] as const) {
    const out = Sigil.buildSystemPrompt({ budget });
    assert.ok(out.length > 0, `Budget ${budget} produced empty output`);
    assert.match(out, /Available components:/);
  }
});
