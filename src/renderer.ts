import {validateNode} from "./runtime.js";
import {ComponentRegistry} from "./registry.js";
import {DesignTokens, looksLikeTokenPath} from "./tokens.js";
import {createOrFallbackElement} from "./utils.js";
import type {UINode} from "./types.js";

export interface SigilRendererOptions {
    /**
     * When a prop is declared `type: "token"` and its value is a token path,
     * rewrite the value to `var(--…)` before assigning to the element so the
     * component can use it directly as a CSS value. Defaults to true.
     *
     * Global token CSS (the `--…` variable declarations themselves) is mounted
     * separately via `DesignTokens.mountStyles()` — call that once at app
     * boot, not per render.
     */
    resolveTokenProps?: boolean;
}

function resolvePropValue(component: string, name: string, value: unknown): unknown {
    if (!looksLikeTokenPath(value)) return value;
    const decl = ComponentRegistry.getInternal(component);
    const prop = decl?.props[name];
    if (!prop || prop.type !== "token") return value;
    if (DesignTokens.size > 0 && !DesignTokens.resolve(value)) return value;
    return DesignTokens.cssVarRef(value);
}

function renderNode(node: UINode, parent: Node, resolveTokens: boolean): void {
    const validation = validateNode(node);
    const element = createOrFallbackElement(node.component);

    if (node.props && validation.valid) {
        for (const [name, value] of Object.entries(node.props)) {
            const finalValue = resolveTokens ? resolvePropValue(node.component, name, value) : value;
            (element as unknown as Record<string, unknown>)[name] = finalValue;
        }
    }

    if (typeof node.children === "string") {
        element.appendChild(document.createTextNode(node.children));
    } else if (Array.isArray(node.children)) {
        for (const child of node.children) {
            renderNode(child, element, resolveTokens);
        }
    }

    if (node.slots && typeof node.slots === "object") {
        for (const [slotName, slotValue] of Object.entries(node.slots)) {
            if (typeof slotValue === "string") {
                const text = document.createElement("span");
                if (slotName !== "default") text.slot = slotName;
                text.textContent = slotValue;
                element.appendChild(text);
            } else if (Array.isArray(slotValue)) {
                for (const child of slotValue) {
                    const temp = document.createElement("div");
                    renderNode(child, temp, resolveTokens);
                    const slotted = temp.firstElementChild as HTMLElement | null;
                    if (slotted) {
                        if (slotName !== "default") slotted.slot = slotName;
                        element.appendChild(slotted);
                    }
                }
            }
        }
    }

    parent.appendChild(element);
}

export class SigilRenderer {
    #resolveTokens: boolean;

    constructor(public readonly container: HTMLElement, options: SigilRendererOptions = {}) {
        this.#resolveTokens = options.resolveTokenProps !== false;
    }

    render(nodes: readonly UINode[]): void {
        for (const node of nodes) {
            renderNode(node, this.container, this.#resolveTokens);
        }
    }

    clear(): void {
        while (this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
        }
    }
}
