import test from "node:test";
import assert from "node:assert/strict";
import { agent, prop, slot, tag, ComponentRegistry, AgentRuntime } from "../src/index.js";

class FakeHTMLElement {}

globalThis.HTMLElement = FakeHTMLElement;
globalThis.customElements = {
  map: new Map(),
  define(name, ctor) {
    this.map.set(name, ctor);
  },
  get(name) {
    return this.map.get(name);
  }
};

function applyClassDecorator(decorator, ctor, name) {
  const initializers = [];
  decorator(ctor, {
    kind: "class",
    name,
    addInitializer(fn) {
      initializers.push(fn);
    }
  });
  for (const init of initializers) {
    init.call(ctor);
  }
}

function applyFieldDecorator(decorator, instance, ctor, name) {
  const initializers = [];
  decorator(undefined, {
    kind: "field",
    name,
    addInitializer(fn) {
      initializers.push(fn);
    }
  });
  for (const init of initializers) {
    init.call(instance);
  }
}

test("decorators register component and props/slots", () => {
  class DemoComponent extends FakeHTMLElement {
    constructor() {
      super();
      this.title = "";
      this.outcome = "upheld";
      this.footerSlot = "";
    }
  }

  applyClassDecorator(tag("verdict-card"), DemoComponent, "DemoComponent");
  applyClassDecorator(agent("Verdict summary card"), DemoComponent, "DemoComponent");

  const instance = new DemoComponent();
  applyFieldDecorator(prop("Title", { required: true }), instance, DemoComponent, "title");
  applyFieldDecorator(prop("Outcome", { values: ["upheld", "dismissed", "partial"], required: true }), instance, DemoComponent, "outcome");
  applyFieldDecorator(slot("Footer"), instance, DemoComponent, "footerSlot");

  const declaration = ComponentRegistry.get("verdict-card");
  assert.ok(declaration);
  assert.equal(declaration.tag, "verdict-card");
  assert.equal(declaration.props.title.type, "string");
  assert.equal(declaration.props.outcome.type, "enum");
  assert.deepEqual(declaration.props.outcome.values, ["upheld", "dismissed", "partial"]);
  assert.ok(globalThis.customElements.get("verdict-card"));
});

test("minimal manifest includes shorthands and required flag", () => {
  const manifest = ComponentRegistry.getManifest({ budget: "minimal" });
  assert.match(manifest, /verdict-card\(title:str!, outcome:upheld\|dismissed\|partial!\)/);
});

test("runtime parse and validate enforce required/enum/min-max", () => {
  const parsed = AgentRuntime.parse('{"component":"verdict-card","props":{"title":"Case","outcome":"upheld"}}');
  assert.equal(parsed.type, "ui");
  const valid = AgentRuntime.validate(parsed.nodes[0]);
  assert.equal(valid.valid, true);

  const bad = AgentRuntime.validate({
    component: "verdict-card",
    props: { outcome: "invalid", extra: 1 }
  });
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.some((e) => e.prop === "title" && e.severity === "error"));
  assert.ok(bad.errors.some((e) => e.prop === "outcome" && e.severity === "error"));
  assert.ok(bad.errors.some((e) => e.prop === "extra" && e.severity === "warning"));
});
