import plugin from "../../vendor/oxc-effect/plugin.js";

export interface OxlintPlugin {
  readonly rules: Readonly<Record<string, unknown>>;
  readonly [key: string]: unknown;
}

export default plugin as OxlintPlugin;
