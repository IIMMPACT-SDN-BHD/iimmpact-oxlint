import { describe, expect, test } from "bun:test";

import { discoverPluginGroups } from "../scripts/upstream-plugin-groups.js";

describe("discoverPluginGroups", () => {
  test("discovers plugin objects regardless of entrypoint or factory syntax", () => {
    const groups = discoverPluginGroups({
      "src/index.ts": `
        const generic = eslintCompatPlugin <Options> ({
          meta: { name: "anti-slop" },
          rules: genericRules,
        });
      `,
      "src/plugin.ts": `
        const react = customFactory({
          meta: { name: "anti-slop-react" },
          rules: {},
        });
      `,
    });

    expect([...groups]).toEqual([
      ["anti-slop", "src/index.ts"],
      ["anti-slop-react", "src/plugin.ts"],
    ]);
  });

  test("ignores rule metadata without a plugin rules inventory", () => {
    expect(
      discoverPluginGroups({
        "src/rules/example.ts": `defineRule({
          meta: { name: "not-a-plugin" },
          create() {},
        });`,
      }).size,
    ).toBe(0);
  });

  test("rejects duplicate plugin names", () => {
    expect(() =>
      discoverPluginGroups({
        "src/one.ts": 'factory({ meta: { name: "duplicate" }, rules: {} });',
        "src/two.ts": 'factory({ meta: { name: "duplicate" }, rules: {} });',
      }),
    ).toThrow("defined in both src/one.ts and src/two.ts");
  });

  test("rejects plugin-like objects with computed metadata", () => {
    expect(() =>
      discoverPluginGroups({
        "src/plugin.ts": "factory({ meta: { name: pluginName }, rules: {} });",
      }),
    ).toThrow("must declare a literal meta.name");
  });
});
