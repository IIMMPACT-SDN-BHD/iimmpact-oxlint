import { RuleTester } from "oxlint/plugins-dev";

import { noChainedTypeAssertionsRule } from "../vendor/anti-slop/src/rules/no-chained-type-assertions.ts";
import { noForbiddenTermInSymbolNamesRule } from "../vendor/anti-slop/src/rules/no-shape-in-symbol-names.ts";
import { noUnknownParametersRule } from "../vendor/anti-slop/src/rules/no-unknown-parameters.ts";

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "ts" } },
});

tester.run(
  "anti-slop/no-chained-type-assertions",
  noChainedTypeAssertionsRule,
  {
    valid: ["const value = input as string;", "const value = [1, 2] as const;"],
    invalid: [
      {
        code: "const value = input as unknown as string;",
        errors: [{ messageId: "chained" }],
      },
    ],
  },
);

tester.run(
  "anti-slop/no-shape-in-symbol-names",
  noForbiddenTermInSymbolNamesRule,
  {
    valid: ["const accountRecord = {};"],
    invalid: [
      {
        code: "const responseShape = {};",
        errors: [{ messageId: "forbiddenSymbolName" }],
      },
    ],
  },
);

tester.run("anti-slop/no-unknown-parameters", noUnknownParametersRule, {
  valid: ["function parse(value: string) { return value; }"],
  invalid: [
    {
      code: "function parse(value: unknown) { return value; }",
      errors: [{ messageId: "unknownParameter" }],
    },
  ],
});
