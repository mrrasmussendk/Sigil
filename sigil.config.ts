import { defineConfig } from "./src/config.js";

/**
 * Demo config. In a real consumer project this would be:
 *
 *     import { defineConfig } from "sigil/config";
 *
 * Two modes:
 *  - With `components.include`: `npm run gen:components` writes a barrel
 *    that imports every matched file (populating ComponentRegistry).
 *  - Without it: tooling no-ops; your app is responsible for importing
 *    component modules, and the runtime ComponentRegistry is the source
 *    of truth.
 */
export default defineConfig({
  components: {
    include: ["demo/components/**/*.ts"],
    exclude: ["**/*.generated.ts", "**/*.test.ts"],
    output: "demo/components.generated.ts"
  },
  manifest: {
    budget: "minimal"
  }
});
