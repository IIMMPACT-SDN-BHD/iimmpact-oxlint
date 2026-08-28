import { RuleTester } from "oxlint/plugins-dev";

import { noCauseDroppingRecoveryRule } from "../src/plugins/effect/no-cause-dropping-recovery.ts";

new RuleTester().run(
  "no-cause-dropping-recovery",
  noCauseDroppingRecoveryRule,
  {
    valid: [
      `Effect.catch((failure) => Effect.fail(mintGeneric(failure)))`,
      `Effect.catchAll((failure) => Effect.fail(failure))`,
      `Effect.catchTag("Foo", (failure) => Effect.fail(new Wrapped("msg", { cause: failure })))`,
      `Effect.catch((failure) => {
        const cause = failure;
        return Effect.fail(mintGeneric(cause));
      })`,
      `Effect.catch((failure) => {
        const wrapped = mintGeneric(failure);
        return Effect.fail(wrapped);
      })`,
      `Effect.catch((failure) => {
        if (failure instanceof Foo) return Effect.fail(failure);
        return Effect.succeed(cachedPage);
      })`,
      `Effect.mapError((error) => new Wrapped("msg", { cause: error }))`,
      `Effect.mapError(effect, (error) => {
        const cause = error;
        return wrap(cause);
      })`,
      `Effect.catch((failure) => Effect.fail(mintGeneric(opaqueValue)))`,
    ],
    invalid: [
      {
        code: `Effect.catch((failure) => {
          if (failure instanceof Foo) return Effect.fail(failure);
          return Effect.fail(mintGeneric());
        })`,
        errors: [{ messageId: "droppedCause" }],
        output: null,
      },
      {
        code: `source.pipe(Effect.catchAll((failure) => Effect.fail(new GenericError("failed"))))`,
        errors: [{ messageId: "droppedCause" }],
        output: null,
      },
      {
        code: `Effect.catchTag(source, "Foo", (failure) => {
          const replacement = mintGeneric();
          return Effect.fail(replacement);
        })`,
        errors: [{ messageId: "droppedCause" }],
        output: null,
      },
      {
        code: `Effect.mapError((error) => mintGeneric())`,
        errors: [{ messageId: "droppedCause" }],
        output: null,
      },
    ],
  },
);
