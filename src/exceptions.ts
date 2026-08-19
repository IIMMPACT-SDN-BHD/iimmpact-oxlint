import type { RuleSeverity } from "./generated/manifests.js";

export type RuleSetting =
  | RuleSeverity
  | "off"
  | readonly [RuleSeverity | "off", ...unknown[]];

export interface ScopedException {
  files: readonly string[];
  rules: Readonly<Record<string, RuleSetting>>;
}

export interface OxlintConfig {
  jsPlugins: readonly { name: string; specifier: string }[];
  rules: Readonly<Record<string, RuleSeverity>>;
  options?: Readonly<{
    typeAware?: boolean;
  }>;
  overrides?: readonly ScopedException[];
}

/** Add narrowly scoped, reviewable exceptions without weakening package defaults. */
export function withExceptions<T extends OxlintConfig>(
  preset: T,
  exceptions: readonly ScopedException[],
): T & { overrides?: readonly ScopedException[] } {
  if (exceptions.length === 0) return preset;
  return {
    ...preset,
    overrides: [...(preset.overrides ?? []), ...exceptions],
  };
}
