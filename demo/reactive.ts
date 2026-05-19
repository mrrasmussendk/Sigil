import type { AgentElement } from "./element.js";

/**
 * Accessor decorator that triggers a re-render on the owning {@link AgentElement}
 * when the value changes. Use together with `accessor` fields:
 *
 *     class Foo extends AgentElement {
 *       \@reactive accessor count = 0;
 *     }
 */
export function reactive<This extends AgentElement, V>(
  target: ClassAccessorDecoratorTarget<This, V>,
  _context: ClassAccessorDecoratorContext<This, V>
): ClassAccessorDecoratorResult<This, V> {
  return {
    get(this: This): V {
      return target.get.call(this);
    },
    set(this: This, value: V): void {
      const previous = target.get.call(this);
      target.set.call(this, value);
      if (!Object.is(previous, value)) {
        this.requestRender();
      }
    }
  };
}
