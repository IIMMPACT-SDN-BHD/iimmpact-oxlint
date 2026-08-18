import { describe, expect, test } from "bun:test";

import { presets, withExceptions } from "../src/index.js";

describe("presets", () => {
  test("have the derived rule counts and preserve severities", () => {
    expect(Object.keys(presets.base.rules)).toHaveLength(15);
    expect(Object.keys(presets.effect.rules)).toHaveLength(76);
    expect(Object.keys(presets["effect-web"].rules)).toHaveLength(81);
    expect(Object.keys(presets.full.rules)).toHaveLength(87);
    expect(presets.full.rules["anti-slop/no-module-mocking"]).toBe("error");
    expect(presets.full.rules["effect/no-effect-succeed-variable"]).toBe(
      "warn",
    );
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
});
