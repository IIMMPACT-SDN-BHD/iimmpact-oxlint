import {
  antiSlopRules,
  effectCoreRules,
  effectFullRules,
  effectWebRules,
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
  base: { jsPlugins: [plugins.antiSlop], rules: antiSlopRules },
  effect: {
    jsPlugins: [plugins.antiSlop, plugins.effect],
    rules: mergeRules(antiSlopRules, effectCoreRules),
  },
  "effect-web": {
    jsPlugins: [plugins.antiSlop, plugins.effect],
    rules: mergeRules(antiSlopRules, effectCoreRules, effectWebRules),
  },
  full: {
    jsPlugins: [plugins.antiSlop, plugins.effect],
    rules: mergeRules(antiSlopRules, effectFullRules),
  },
} as const satisfies Record<PresetName, OxlintConfig>;

export const base = presets.base;
export const effect = presets.effect;
export const effectWeb = presets["effect-web"];
export const full = presets.full;

export function getPreset(name: PresetName): OxlintConfig {
  return presets[name];
}
