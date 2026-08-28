import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

type FunctionExpression =
  | ESTree.ArrowFunctionExpression
  | (ESTree.Function & {
      readonly type: "FunctionExpression";
      readonly body: ESTree.FunctionBody;
    });
type VisitorKeys = Readonly<Record<string, readonly string[]>>;
type ReferenceResult = "found" | "missing" | "unknown";

const recoveryMethods = new Set(["catch", "catchAll", "catchTag", "mapError"]);

function isNode(value: unknown): value is ESTree.Node {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof value.type === "string"
  );
}

function isFunctionExpression(node: ESTree.Node): node is FunctionExpression {
  return (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionExpression"
  );
}

function memberName(node: ESTree.MemberExpression): string | null {
  if (!node.computed && node.property.type === "Identifier") {
    return node.property.name;
  }
  if (
    node.computed &&
    node.property.type === "Literal" &&
    typeof node.property.value === "string"
  ) {
    return node.property.value;
  }
  return null;
}

function effectMethod(node: ESTree.CallExpression): string | null {
  if (
    node.callee.type !== "MemberExpression" ||
    node.callee.object.type !== "Identifier" ||
    node.callee.object.name !== "Effect"
  ) {
    return null;
  }
  return memberName(node.callee);
}

function recoveryCallback(
  node: ESTree.CallExpression,
): FunctionExpression | null {
  const method = effectMethod(node);
  if (method === null || !recoveryMethods.has(method)) return null;

  for (let index = node.arguments.length - 1; index >= 0; index -= 1) {
    const argument = node.arguments[index];
    if (argument !== undefined && isFunctionExpression(argument))
      return argument;
  }
  return null;
}

function walkOwnScope(
  node: ESTree.Node,
  visitorKeys: VisitorKeys,
  visit: (node: ESTree.Node) => void,
  root: ESTree.Node = node,
): void {
  visit(node);
  if (node !== root && isFunctionExpression(node)) return;

  const record = node as unknown as Readonly<Record<string, unknown>>;
  for (const key of visitorKeys[node.type] ?? []) {
    const value = record[key];
    if (isNode(value)) {
      walkOwnScope(value, visitorKeys, visit, root);
      continue;
    }
    if (!Array.isArray(value)) continue;
    for (const child of value) {
      if (isNode(child)) walkOwnScope(child, visitorKeys, visit, root);
    }
  }
}

function localInitializers(
  callback: FunctionExpression,
  visitorKeys: VisitorKeys,
): ReadonlyMap<string, ESTree.Expression> {
  const initializers = new Map<string, ESTree.Expression>();
  const ambiguous = new Set<string>();

  walkOwnScope(callback.body, visitorKeys, (node) => {
    if (node.type !== "VariableDeclaration" || node.kind !== "const") return;
    for (const declaration of node.declarations) {
      if (declaration.id.type !== "Identifier" || declaration.init === null) {
        continue;
      }
      const name = declaration.id.name;
      if (initializers.has(name)) {
        initializers.delete(name);
        ambiguous.add(name);
      } else if (!ambiguous.has(name)) {
        initializers.set(name, declaration.init);
      }
    }
  });

  return initializers;
}

function combine(results: readonly ReferenceResult[]): ReferenceResult {
  if (results.includes("found")) return "found";
  if (results.includes("unknown")) return "unknown";
  return "missing";
}

function referencesFailure(
  node: ESTree.Node,
  failureName: string,
  initializers: ReadonlyMap<string, ESTree.Expression>,
  visitorKeys: VisitorKeys,
  resolving: ReadonlySet<string> = new Set(),
): ReferenceResult {
  if (node.type === "Identifier") {
    if (node.name === failureName) return "found";
    const initializer = initializers.get(node.name);
    if (initializer === undefined || resolving.has(node.name)) return "unknown";
    return referencesFailure(
      initializer,
      failureName,
      initializers,
      visitorKeys,
      new Set([...resolving, node.name]),
    );
  }
  if (node.type === "Literal") return "missing";
  if (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionExpression" ||
    node.type === "FunctionDeclaration"
  ) {
    return "unknown";
  }
  if (node.type === "CallExpression" || node.type === "NewExpression") {
    return combine(
      node.arguments.map((argument) =>
        referencesFailure(
          argument,
          failureName,
          initializers,
          visitorKeys,
          resolving,
        ),
      ),
    );
  }
  if (node.type === "Property") {
    if (node.computed) {
      return combine([
        referencesFailure(
          node.key,
          failureName,
          initializers,
          visitorKeys,
          resolving,
        ),
        referencesFailure(
          node.value,
          failureName,
          initializers,
          visitorKeys,
          resolving,
        ),
      ]);
    }
    return referencesFailure(
      node.value,
      failureName,
      initializers,
      visitorKeys,
      resolving,
    );
  }

  const record = node as unknown as Readonly<Record<string, unknown>>;
  const results: ReferenceResult[] = [];
  for (const key of visitorKeys[node.type] ?? []) {
    const value = record[key];
    if (isNode(value)) {
      results.push(
        referencesFailure(
          value,
          failureName,
          initializers,
          visitorKeys,
          resolving,
        ),
      );
      continue;
    }
    if (!Array.isArray(value)) continue;
    for (const child of value) {
      if (!isNode(child)) continue;
      results.push(
        referencesFailure(
          child,
          failureName,
          initializers,
          visitorKeys,
          resolving,
        ),
      );
    }
  }
  return combine(results);
}

function mintedExpression(
  node: ESTree.Node,
  initializers: ReadonlyMap<string, ESTree.Expression>,
  resolving: ReadonlySet<string> = new Set(),
): ESTree.CallExpression | ESTree.NewExpression | null {
  if (node.type === "CallExpression" || node.type === "NewExpression") {
    return node;
  }
  if (node.type !== "Identifier" || resolving.has(node.name)) return null;
  const initializer = initializers.get(node.name);
  if (initializer === undefined) return null;
  return mintedExpression(
    initializer,
    initializers,
    new Set([...resolving, node.name]),
  );
}

export const noCauseDroppingRecoveryRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require errors minted in Effect recovery callbacks to retain the caught failure.",
    },
    messages: {
      droppedCause:
        "This recovery path creates a fresh error without the caught failure. Pass the failure as or inside the new error's cause.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callback = recoveryCallback(node);
        if (callback === null) return;
        const parameter = callback.params[0];
        if (parameter?.type !== "Identifier") return;

        const visitorKeys = context.sourceCode.visitorKeys;
        const initializers = localInitializers(callback, visitorKeys);
        const reportMintedWithoutCause = (candidate: ESTree.Node): void => {
          const minted = mintedExpression(candidate, initializers);
          if (minted === null) return;
          if (
            referencesFailure(
              minted,
              parameter.name,
              initializers,
              visitorKeys,
            ) !== "missing"
          ) {
            return;
          }
          context.report({ node: minted, messageId: "droppedCause" });
        };

        walkOwnScope(callback.body, visitorKeys, (candidate) => {
          if (
            candidate.type === "CallExpression" &&
            effectMethod(candidate) === "fail"
          ) {
            const failedWith = candidate.arguments[0];
            if (failedWith !== undefined) reportMintedWithoutCause(failedWith);
          }
        });

        if (effectMethod(node) !== "mapError") return;
        if (callback.body.type !== "BlockStatement") {
          reportMintedWithoutCause(callback.body);
          return;
        }
        walkOwnScope(callback.body, visitorKeys, (candidate) => {
          if (
            candidate.type !== "ReturnStatement" ||
            candidate.argument === null
          ) {
            return;
          }
          if (
            candidate.argument.type === "CallExpression" &&
            effectMethod(candidate.argument) === "fail"
          ) {
            return;
          }
          reportMintedWithoutCause(candidate.argument);
        });
      },
    };
  },
});
