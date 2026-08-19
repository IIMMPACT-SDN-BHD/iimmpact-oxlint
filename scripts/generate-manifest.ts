import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse } from "jsonc-parser";
import { format } from "prettier";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(process.env.MANIFEST_SOURCE_ROOT ?? repositoryRoot);
const outputRoot = resolve(process.env.MANIFEST_OUTPUT_ROOT ?? repositoryRoot);
const checkOnly = process.argv.includes("--check");

type Severity = "error" | "warn";
type RuleMap = Record<string, Severity>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function readConfig(name: string): Promise<RuleMap> {
  const path = resolve(sourceRoot, `vendor/oxc-effect/configs/${name}.jsonc`);
  const errors: { error: number; offset: number; length: number }[] = [];
  const config = parse(await readFile(path, "utf8"), errors) as
    | { rules?: RuleMap }
    | undefined;
  assert(errors.length === 0, `Could not parse ${path} as JSONC`);
  assert(config?.rules, `${path} does not contain a rules object`);
  return config.rules;
}

const antiPlugin = (await import(
  pathToFileURL(resolve(sourceRoot, "vendor/anti-slop/src/index.ts")).href
)) as { default: { rules: Record<string, unknown> } };
const antiEffectPlugin = (await import(
  pathToFileURL(resolve(sourceRoot, "vendor/anti-slop/src/effect/index.ts"))
    .href
)) as { default: { rules: Record<string, unknown> } };
const antiNames = Object.keys(antiPlugin.default.rules);
const antiEffectNames = Object.keys(antiEffectPlugin.default.rules);

const qualify = (namespace: string, names: readonly string[]): RuleMap =>
  Object.fromEntries(
    names.map((name) => [`${namespace}/${name}`, "error" as const]),
  );

const anti = qualify("anti-slop", antiNames);
const antiEffect = qualify("anti-slop-effect", antiEffectNames);
const typescriptDiscipline = qualify("typescript", [
  "no-explicit-any",
  "no-non-null-assertion",
  "no-unnecessary-type-assertion",
  "no-unsafe-argument",
  "no-unsafe-assignment",
  "no-unsafe-call",
  "no-unsafe-member-access",
  "no-unsafe-return",
  "no-unsafe-type-assertion",
  "switch-exhaustiveness-check",
  "use-unknown-in-catch-callback-variable",
]);
const core = await readConfig("core");
const webConfig = await readConfig("web");
const tsType = await readConfig("ts-type");
const full = await readConfig("full");
const { rules: effectImplementations } = (await import(
  pathToFileURL(resolve(sourceRoot, "vendor/oxc-effect/rules/index.js")).href
)) as { rules: Record<string, unknown> };

assert(
  Object.keys(anti).length > 0,
  "The anti-slop plugin must expose at least one rule",
);
assert(
  Object.keys(antiEffect).length > 0,
  "The anti-slop Effect plugin must expose at least one rule",
);
assert(
  Object.keys(full).length > 0,
  "The Effect full preset must expose at least one rule",
);
const implementedEffectRules = new Set(
  Object.keys(effectImplementations).map((rule) => `effect/${rule}`),
);
assert(
  implementedEffectRules.size === Object.keys(full).length &&
    Object.keys(full).every((rule) => implementedEffectRules.has(rule)),
  "Effect implementation inventory must exactly match its full preset",
);
const upstreamRuleCount =
  Object.keys(anti).length +
  Object.keys(antiEffect).length +
  Object.keys(full).length;
assert(
  new Set([
    ...Object.keys(anti),
    ...Object.keys(antiEffect),
    ...Object.keys(full),
  ]).size === upstreamRuleCount,
  "Upstream plugin rule namespaces must not overlap",
);
const curatedRuleCount =
  upstreamRuleCount + Object.keys(typescriptDiscipline).length;
assert(
  new Set([
    ...Object.keys(anti),
    ...Object.keys(antiEffect),
    ...Object.keys(typescriptDiscipline),
    ...Object.keys(full),
  ]).size === curatedRuleCount,
  "Full curated preset must contain every unique rule",
);

const upstreamPresetUnion = new Set([
  ...Object.keys(core),
  ...Object.keys(webConfig),
  ...Object.keys(tsType),
]);
assert(
  upstreamPresetUnion.size === Object.keys(full).length &&
    Object.keys(full).every((rule) => upstreamPresetUnion.has(rule)),
  "Effect full must equal the union of the upstream core, web, and ts-type presets",
);
for (const [rule, severity] of Object.entries({
  ...core,
  ...webConfig,
  ...tsType,
})) {
  assert(full[rule] === severity, `Preset severity mismatch for ${rule}`);
}

const sorted = (rules: RuleMap): RuleMap =>
  Object.fromEntries(
    Object.entries(rules).sort(([left], [right]) => left.localeCompare(right)),
  );
const values = {
  antiSlopRules: sorted(anti),
  antiSlopEffectRules: sorted(antiEffect),
  typescriptDisciplineRules: sorted(typescriptDiscipline),
  effectCoreRules: sorted(core),
  effectWebRules: sorted(webConfig),
  effectFullRules: sorted(full),
};
const presetValues = {
  base: sorted({ ...anti, ...typescriptDiscipline }),
  effect: sorted({
    ...anti,
    ...antiEffect,
    ...typescriptDiscipline,
    ...core,
  }),
  "effect-web": sorted({
    ...anti,
    ...antiEffect,
    ...typescriptDiscipline,
    ...core,
    ...webConfig,
  }),
  full: sorted({ ...anti, ...antiEffect, ...typescriptDiscipline, ...full }),
};

const generated = await format(
  `// Generated by scripts/generate-manifest.ts. Do not edit.\n\nexport type RuleSeverity = "error" | "warn";\n\n${Object.entries(
    values,
  )
    .map(
      ([name, rules]) =>
        `export const ${name} = ${JSON.stringify(rules, null, 2)} as const satisfies Readonly<Record<string, RuleSeverity>>;`,
    )
    .join("\n\n")}\n`,
  { parser: "typescript" },
);

const manifest = `${JSON.stringify(
  {
    generatedFrom:
      "vendor source snapshots, upstream presets, and the curated TypeScript discipline inventory",
    counts: {
      antiSlop: Object.keys(values.antiSlopRules).length,
      antiSlopEffect: Object.keys(values.antiSlopEffectRules).length,
      typescriptDiscipline: Object.keys(values.typescriptDisciplineRules)
        .length,
      effect: Object.keys(values.effectFullRules).length,
      full: Object.keys(presetValues.full).length,
    },
    rules: {
      antiSlop: values.antiSlopRules,
      antiSlopEffect: values.antiSlopEffectRules,
      typescriptDiscipline: values.typescriptDisciplineRules,
      effect: values.effectFullRules,
    },
    presets: presetValues,
  },
  null,
  2,
)}\n`;

const outputs = [
  [resolve(outputRoot, "src/generated/manifests.ts"), generated],
  [resolve(outputRoot, "rules.manifest.json"), manifest],
] as const;

if (checkOnly) {
  for (const [path, expected] of outputs) {
    const actual = await readFile(path, "utf8").catch(() => "");
    assert(
      actual === expected,
      `${path} is stale; run bun run manifest:generate`,
    );
  }
  console.log("Generated manifests are current");
} else {
  for (const [path, contents] of outputs) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents);
  }
  console.log(
    `Generated manifests: ${Object.keys(presetValues.full).length} rules`,
  );
}
