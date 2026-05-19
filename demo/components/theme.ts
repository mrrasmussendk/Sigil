import { agent, prop, tag } from "../../src/index.js";
import { AgentElement } from "../element.js";
import { reactive } from "../reactive.js";
import { escapeHtml } from "../format.js";

/**
 * A single color swatch driven by a DTCG design token reference. The
 * `color` prop is declared `type: "token"` so the runtime validates that
 * the agent's dot-path resolves in the loaded token set, and the renderer
 * rewrites the value to `var(--…)` before assigning — letting the template
 * use `this.color` directly as a CSS value.
 */
@agent("Design-token color swatch. Agents pass a DTCG path like color.brand.accent to color.")
@tag("theme-swatch")
export class ThemeSwatchElement extends AgentElement {
  @prop("Display name for the swatch", { type: "string", required: true })
  @reactive accessor label: string = "";

  @prop("DTCG color token reference (dot-path)", { type: "token", group: "color", required: true })
  @reactive accessor color: string = "";

  @prop("Optional caption shown under the label", { type: "string" })
  @reactive accessor caption: string = "";

  protected override template(): string {
    return `
      <article class="card theme-swatch">
        <div class="swatch-chip" style="background:${escapeHtml(this.color)}"></div>
        <div class="swatch-meta">
          <h4>${escapeHtml(this.label)}</h4>
          <code class="swatch-caption">${escapeHtml(this.caption || this.color)}</code>
        </div>
      </article>
    `;
  }
}
