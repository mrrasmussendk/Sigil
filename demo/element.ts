/**
 * Reactive web-component base for the finance demo.
 *
 * Subclasses provide a `template()` returning the HTML string for the
 * element. Whenever a `@reactive accessor` field changes, the element
 * schedules a microtask render. The base is intentionally tiny — it is not
 * a generic templating layer.
 */
export abstract class AgentElement extends HTMLElement {
  #pending = false;
  #firstRendered = false;

  override connectedCallback(): void {
    this.requestRender();
  }

  /** Mark the element dirty; renders on the next microtask. */
  requestRender(): void {
    if (this.#pending) return;
    this.#pending = true;
    queueMicrotask(() => {
      this.#pending = false;
      if (!this.isConnected) return;
      this.innerHTML = this.template();
      this.#firstRendered = true;
      this.afterRender();
    });
  }

  /** True once the element has rendered at least once. */
  get hasRendered(): boolean {
    return this.#firstRendered;
  }

  /** Override to run logic after each render (e.g. event wiring). */
  protected afterRender(): void {
    /* no-op by default */
  }

  /** Subclasses produce the element's HTML string. */
  protected abstract template(): string;
}

// Lets stage 3 decorator types resolve `connectedCallback` override correctly
// across the demo without having to widen visibility everywhere.
declare global {
  interface HTMLElement {
    connectedCallback?(): void;
  }
}
