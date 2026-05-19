import type { DesignTokenFile } from "../src/index.js";

/**
 * Design tokens for the Sigil demo.
 *
 * Enterprise / institutional finance aesthetic — light warm surface,
 * deep navy ink, single bronze accent. Sourced from the design handoff
 * (`cdp/project/demo.html`).
 *
 * Loaded once at boot via `DesignTokens.load(demoTokens)`; the framework
 * emits the matching `--color-…` custom properties via
 * `DesignTokens.mountStyles()` and validates any `type: "token"` prop
 * the agent emits by dot-path.
 */
export const demoTokens: DesignTokenFile = {
  color: {
    surface: {
      $type: "color",
      bg:      { $value: "oklch(0.985 0.004 85)", $description: "Page background (warm off-white)" },
      "elev-1": { $value: "oklch(0.965 0.005 85)", $description: "Subtle elevation, e.g. table headers" },
      "elev-2": { $value: "oklch(0.945 0.006 85)", $description: "Stronger inset surfaces" },
      card:    { $value: "#ffffff", $description: "Card / panel surface" }
    },
    border: {
      $type: "color",
      subtle: { $value: "oklch(0.92 0.006 250)" },
      base:   { $value: "oklch(0.88 0.008 250)" },
      strong: { $value: "oklch(0.78 0.012 250)" }
    },
    text: {
      $type: "color",
      primary: { $value: "oklch(0.22 0.045 255)", $description: "Near-black navy" },
      "primary-1": { $value: "oklch(0.32 0.050 255)" },
      muted:   { $value: "oklch(0.48 0.040 255)" },
      faint:   { $value: "oklch(0.62 0.025 255)" }
    },
    brand: {
      $type: "color",
      primary: { $value: "oklch(0.36 0.085 255)", $description: "Signature navy" },
      "primary-soft": { $value: "oklch(0.94 0.020 255)" },
      accent: { $value: "oklch(0.58 0.10 60)", $description: "Institutional bronze" },
      "accent-soft": { $value: "oklch(0.95 0.030 60)" }
    },
    state: {
      $type: "color",
      up:        { $value: "oklch(0.52 0.10 155)", $description: "Positive movement" },
      "up-soft": { $value: "oklch(0.94 0.04 155)" },
      down:      { $value: "oklch(0.52 0.16 25)", $description: "Negative movement" },
      "down-soft": { $value: "oklch(0.94 0.06 25)" },
      warn:      { $value: "{color.brand.accent}" },
      "warn-soft": { $value: "{color.brand.accent-soft}" },
      flat:      { $value: "{color.text.muted}" }
    },
    chart: {
      $type: "color",
      $description: "Categorical chart palette for allocation bars + segments",
      "seg-0": { $value: "{color.brand.primary}" },
      "seg-1": { $value: "{color.brand.accent}" },
      "seg-2": { $value: "{color.state.up}" },
      "seg-3": { $value: "oklch(0.7 0.02 250)" },
      "seg-4": { $value: "oklch(0.52 0.08 200)" },
      "seg-5": { $value: "oklch(0.55 0.10 320)" }
    },
    syntax: {
      $type: "color",
      $description: "JSON-pane syntax highlighting",
      keyword: { $value: "oklch(0.46 0.10 295)" },
      string:  { $value: "oklch(0.42 0.10 155)" },
      number:  { $value: "oklch(0.52 0.13 60)" },
      punct:   { $value: "oklch(0.58 0.02 250)" }
    }
  }
};
