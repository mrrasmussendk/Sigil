import { validateNode } from "./runtime.js";
import { createOrFallbackElement } from "./utils.js";

function renderNode(node, parent) {
  const validation = validateNode(node);
  const element = createOrFallbackElement(node.component);
  if (node.props && validation.valid) {
    for (const [name, value] of Object.entries(node.props)) {
      element[name] = value;
    }
  }

  if (typeof node.children === "string") {
    element.appendChild(document.createTextNode(node.children));
  } else if (Array.isArray(node.children)) {
    for (const child of node.children) {
      renderNode(child, element);
    }
  }

  if (node.slots && typeof node.slots === "object") {
    for (const [slotName, slotValue] of Object.entries(node.slots)) {
      if (typeof slotValue === "string") {
        const text = document.createElement("span");
        if (slotName !== "default") {
          text.slot = slotName;
        }
        text.textContent = slotValue;
        element.appendChild(text);
      } else if (Array.isArray(slotValue)) {
        for (const child of slotValue) {
          const temp = document.createElement("div");
          renderNode(child, temp);
          const slotted = temp.firstChild;
          if (slotted && slotName !== "default") {
            slotted.slot = slotName;
          }
          if (slotted) {
            element.appendChild(slotted);
          }
        }
      }
    }
  }

  parent.appendChild(element);
}

export class AgentRenderer {
  constructor(container) {
    this.container = container;
  }

  render(nodes) {
    for (const node of nodes) {
      renderNode(node, this.container);
    }
  }
}
