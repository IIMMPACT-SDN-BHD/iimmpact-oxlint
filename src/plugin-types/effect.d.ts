export interface OxlintPlugin {
  readonly rules: Readonly<Record<string, unknown>>;
  readonly [key: string]: unknown;
}

declare const plugin: OxlintPlugin;
export default plugin;
