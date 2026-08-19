import {
  antiSlopRules,
  effectCoreRules,
  effectFullRules,
  effectWebRules,
  typescriptDisciplineRules,
  type RuleSeverity,
} from "./generated/manifests.js";
import type { OxlintConfig } from "./exceptions.js";

export { withExceptions } from "./exceptions.js";
export type {
  OxlintConfig,
  RuleSetting,
  ScopedException,
} from "./exceptions.js";
export type { RuleSeverity } from "./generated/manifests.js";

export type PresetName = "base" | "effect" | "effect-web" | "full";

const plugins = {
  antiSlop: {
    name: "anti-slop",
    specifier: "@iimmpact-sdn-bhd/oxlint/anti-slop",
  },
  effect: { name: "effect", specifier: "@iimmpact-sdn-bhd/oxlint/effect" },
} as const;

function mergeRules(
  ...sets: ReadonlyArray<Readonly<Record<string, RuleSeverity>>>
) {
  return Object.assign({}, ...sets) as Readonly<Record<string, RuleSeverity>>;
}

export const presets = {
  base: {
    jsPlugins: [plugins.antiSlop],
    rules: mergeRules(antiSlopRules, typescriptDisciplineRules),
    options: { typeAware: true },
  },
  effect: {
    jsPlugins: [plugins.antiSlop, plugins.effect],
    rules: mergeRules(
      antiSlopRules,
      typescriptDisciplineRules,
      effectCoreRules,
    ),
    options: { typeAware: true },
  },
  "effect-web": {
    jsPlugins: [plugins.antiSlop, plugins.effect],
    rules: mergeRules(
      antiSlopRules,
      typescriptDisciplineRules,
      effectCoreRules,
      effectWebRules,
    ),
    options: { typeAware: true },
  },
  full: {
    jsPlugins: [plugins.antiSlop, plugins.effect],
    rules: mergeRules(
      antiSlopRules,
      typescriptDisciplineRules,
      effectFullRules,
    ),
    options: { typeAware: true },
  },
} as const satisfies Record<PresetName, OxlintConfig>;

export const base = presets.base;
export const effect = presets.effect;
export const effectWeb = presets["effect-web"];
export const full = presets.full;

export function getPreset(name: PresetName): OxlintConfig {
  return presets[name];
}
