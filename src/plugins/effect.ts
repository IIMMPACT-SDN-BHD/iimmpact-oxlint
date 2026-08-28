import { eslintCompatPlugin } from "@oxlint/plugins";

import upstreamPlugin from "../../vendor/oxc-effect/plugin.js";
import { noCauseDroppingRecoveryRule } from "./effect/no-cause-dropping-recovery.js";

export interface OxlintPlugin {
  readonly rules: Readonly<Record<string, unknown>>;
  readonly [key: string]: unknown;
}

const customPlugin = eslintCompatPlugin({
  meta: { name: "effect" },
  rules: {
    "no-cause-dropping-recovery": noCauseDroppingRecoveryRule,
  },
});

const plugin = {
  ...upstreamPlugin,
  rules: {
    ...upstreamPlugin.rules,
    ...customPlugin.rules,
  },
};

export default plugin as OxlintPlugin;
