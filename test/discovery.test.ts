import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  ConfigError,
  findConfig,
  resolveComponentFiles,
  runDiscovery,
  writeComponentBarrel
} from "../src/discovery.js";
import { defineConfig } from "../src/config.js";

function scaffold(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "sigil-disc-"));
  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  };
}

test("defineConfig is an identity helper that types the literal", () => {
  const config = defineConfig({
    components: { include: ["src/**/*.ts"], output: "out.ts" }
  });
  assert.equal(config.components?.output, "out.ts");
});

test("resolveComponentFiles expands globs and excludes the barrel itself", () => {
  const { dir, cleanup } = scaffold();
  try {
    mkdirSync(join(dir, "comps"), { recursive: true });
    writeFileSync(join(dir, "comps", "a.ts"), "export {};");
    writeFileSync(join(dir, "comps", "b.ts"), "export {};");
    writeFileSync(join(dir, "comps", "skip.test.ts"), "export {};");

    const result = resolveComponentFiles(
      { include: ["comps/**/*.ts"], exclude: ["**/*.test.ts"], output: "comps/_barrel.ts" },
      dir
    );

    const fileNames = result.files.map((f) => f.replace(dir, "").replace(/\\/g, "/"));
    assert.deepEqual(fileNames.sort(), ["/comps/a.ts", "/comps/b.ts"]);
    assert.equal(result.outputPath, resolve(dir, "comps/_barrel.ts"));
  } finally {
    cleanup();
  }
});

test("writeComponentBarrel produces deterministic POSIX-style imports with .js extension", () => {
  const { dir, cleanup } = scaffold();
  try {
    mkdirSync(join(dir, "comps"), { recursive: true });
    const files = [
      resolve(dir, "comps", "alpha.ts"),
      resolve(dir, "comps", "beta.ts")
    ];
    const output = resolve(dir, "comps", "_barrel.ts");
    writeComponentBarrel(files, output);
    const text = readFileSync(output, "utf8");
    assert.match(text, /^\/\/ THIS FILE IS GENERATED/);
    assert.match(text, /import "\.\/alpha\.js";/);
    assert.match(text, /import "\.\/beta\.js";/);
    assert.ok(!text.includes("\\"), "barrel must use POSIX separators");
  } finally {
    cleanup();
  }
});

test("findConfig surfaces a clear error when nothing is found", () => {
  const { dir, cleanup } = scaffold();
  try {
    assert.throws(() => findConfig(dir), (err: unknown) => {
      assert.ok(err instanceof ConfigError);
      assert.match((err as Error).message, /No sigil config file found/);
      return true;
    });
  } finally {
    cleanup();
  }
});

test("runDiscovery in 'registry' mode is a no-op when no include is configured", async () => {
  const { dir, cleanup } = scaffold();
  try {
    writeFileSync(
      join(dir, "sigil.config.mjs"),
      `export default { components: {} };\n`
    );
    const result = await runDiscovery({ cwd: dir });
    assert.equal(result.mode, "registry");
    assert.equal(result.files.length, 0);
  } finally {
    cleanup();
  }
});

test("runDiscovery in 'glob' mode writes the barrel and reports the mode", async () => {
  const { dir, cleanup } = scaffold();
  try {
    mkdirSync(join(dir, "parts"), { recursive: true });
    writeFileSync(join(dir, "parts", "one.ts"), "");
    writeFileSync(join(dir, "parts", "two.ts"), "");
    writeFileSync(
      join(dir, "sigil.config.mjs"),
      `export default { components: { include: ["parts/**/*.ts"], output: "barrel.ts" } };\n`
    );

    const result = await runDiscovery({ cwd: dir });
    assert.equal(result.mode, "glob");
    assert.equal(result.files.length, 2);

    const barrel = readFileSync(result.outputPath, "utf8");
    assert.match(barrel, /import "\.\/parts\/one\.js";/);
    assert.match(barrel, /import "\.\/parts\/two\.js";/);
  } finally {
    cleanup();
  }
});
