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

const { agent, prop, tag, Sigil, DesignTokens } = await import("../src/index.js");

const TOKEN_FILE = {
  color: {
    $type: "color",
    brand: {
      primary: { $value: "#3344ff" },
      secondary: { $value: "{color.brand.primary}" }
    },
    surface: { $value: "#ffffff" }
  },
  spacing: {
    $type: "dimension",
    sm: { $value: "8px" },
    md: { $value: "16px", $description: "default gutter" }
  }
};

DesignTokens.load(TOKEN_FILE);

@agent("Themed badge")
@tag("themed-badge")
class ThemedBadge extends FakeHTMLElement {
  @prop("Label", { type: "string", required: true })
  accessor label: string = "";

  @prop("Background color", { type: "token", group: "color", required: true })
  accessor bg: string = "color.surface";

  @prop("Padding", { type: "token", group: "dimension" })
  accessor padding: string = "spacing.sm";
}
void ThemedBadge;

test("DesignTokens flattens, types, and resolves aliases", () => {
  const primary = DesignTokens.resolve("color.brand.primary");
  assert.ok(primary);
  assert.equal(primary.type, "color");
  assert.equal(primary.value, "#3344ff");

  const secondary = DesignTokens.resolve("color.brand.secondary");
  assert.ok(secondary);
  assert.equal(secondary.value, "#3344ff");
  assert.equal(secondary.type, "color");

  const md = DesignTokens.resolve("spacing.md");
  assert.ok(md);
  assert.equal(md.type, "dimension");
  assert.equal(md.description, "default gutter");
});

test("DesignTokens.toCss emits custom properties", () => {
  const css = DesignTokens.toCss();
  assert.match(css, /:root \{/);
  assert.match(css, /--color-brand-primary: #3344ff;/);
  assert.match(css, /--spacing-md: 16px;/);
});

test("validateNode accepts known tokens and rejects unknown / wrong group", () => {
  const ok = Sigil.validate({
    component: "themed-badge",
    props: { label: "x", bg: "color.brand.primary", padding: "spacing.md" }
  });
  assert.equal(ok.valid, true, JSON.stringify(ok.errors));

  const unknown = Sigil.validate({
    component: "themed-badge",
    props: { label: "x", bg: "color.brand.tertiary" }
  });
  assert.ok(unknown.errors.some((e) => e.prop === "bg" && /Unknown design token/.test(e.message)));

  const wrongGroup = Sigil.validate({
    component: "themed-badge",
    props: { label: "x", bg: "spacing.md" }
  });
  assert.ok(wrongGroup.errors.some((e) => e.prop === "bg" && /\$type/.test(e.message)));
});

test("validateNode accepts literal (non-path) strings for token props", () => {
  const literal = Sigil.validate({
    component: "themed-badge",
    props: { label: "x", bg: "#ff0000" }
  });
  assert.equal(literal.valid, true);
});

test("system prompt includes token catalog when tokens are loaded", () => {
  const minimal = Sigil.buildSystemPrompt({ budget: "minimal" });
  assert.match(minimal, /Available design tokens/);
  assert.match(minimal, /color: color\.brand\.primary/);

  const verbose = Sigil.buildSystemPrompt({ budget: "standard" });
  assert.match(verbose, /spacing\.md = 16px — default gutter/);
});

test("manifest shorthands surface the token group", () => {
  const minimal = Sigil.buildSystemPrompt({ budget: "minimal" });
  assert.match(minimal, /themed-badge\(.*bg:tok<color>!.*padding:tok<dimension>.*\)/);
});

test("DesignTokens.clear empties the store", () => {
  const snapshot = DesignTokens.size;
  assert.ok(snapshot > 0);
  DesignTokens.clear();
  assert.equal(DesignTokens.size, 0);
  // Restore for any other test files that run later in the same process.
  DesignTokens.load(TOKEN_FILE);
});
