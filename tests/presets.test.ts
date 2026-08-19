import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { presets, withExceptions } from "../src/index.js";

describe("presets", () => {
  test("have the derived rule counts and preserve severities", () => {
    expect(Object.keys(presets.base.rules)).toHaveLength(26);
    expect(Object.keys(presets.effect.rules)).toHaveLength(87);
    expect(Object.keys(presets["effect-web"].rules)).toHaveLength(92);
    expect(Object.keys(presets.full.rules)).toHaveLength(98);
    expect(presets.full.rules["anti-slop/no-module-mocking"]).toBe("error");
    expect(presets.full.rules["typescript/no-unsafe-assignment"]).toBe("error");
    expect(presets.full.rules["effect/no-effect-succeed-variable"]).toBe(
      "warn",
    );
    expect(presets.full.options).toEqual({ typeAware: true });
  });

  test("adds only explicit scoped exceptions", () => {
    const configured = withExceptions(presets.base, [
      {
        files: ["generated/**"],
        rules: { "anti-slop/no-shape-in-symbol-names": "off" },
      },
    ]);
    expect(configured.rules["anti-slop/no-shape-in-symbol-names"]).toBe(
      "error",
    );
    expect(configured.overrides).toEqual([
      {
        files: ["generated/**"],
        rules: { "anti-slop/no-shape-in-symbol-names": "off" },
      },
    ]);
  });

  test("match the published manifest", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(import.meta.dir, "../rules.manifest.json"), "utf8"),
    ) as {
      counts: { full: number };
      rules: { typescriptDiscipline: Record<string, string> };
      presets: Record<keyof typeof presets, Record<string, string>>;
    };

    expect(Object.keys(manifest.rules.typescriptDiscipline)).toHaveLength(11);
    expect(manifest.counts.full).toBe(Object.keys(presets.full.rules).length);
    for (const name of Object.keys(presets) as (keyof typeof presets)[]) {
      expect(manifest.presets[name]).toEqual(presets[name].rules);
    }
  });
});
