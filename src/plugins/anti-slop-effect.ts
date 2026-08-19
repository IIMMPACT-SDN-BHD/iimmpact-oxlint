import plugin from "../../vendor/anti-slop/src/effect/index.ts";

export interface OxlintPlugin {
  readonly rules: Readonly<Record<string, unknown>>;
  readonly [key: string]: unknown;
}

export default plugin as OxlintPlugin;
