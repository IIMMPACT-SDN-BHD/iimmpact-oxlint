import {
  parseSync,
  Visitor,
  type ObjectExpression,
  type ObjectPropertyKind,
} from "oxc-parser";

function propertyName(property: ObjectPropertyKind): string | null {
  if (property.type !== "Property") return null;
  if (property.key.type === "Identifier") return property.key.name;
  return property.key.type === "Literal" &&
    typeof property.key.value === "string"
    ? property.key.value
    : null;
}

function pluginName(node: ObjectExpression, path: string): string | null {
  const rules = node.properties.find(
    (property) => propertyName(property) === "rules",
  );
  const meta = node.properties.find(
    (property) =>
      property.type === "Property" && propertyName(property) === "meta",
  );
  if (rules === undefined || meta === undefined) return null;
  if (meta.type !== "Property" || meta.value.type !== "ObjectExpression") {
    throw new Error(
      `Plugin-like object in ${path} must declare an inline meta object`,
    );
  }

  const name = meta.value.properties.find(
    (property) =>
      property.type === "Property" && propertyName(property) === "name",
  );
  if (
    name === undefined ||
    name.type !== "Property" ||
    name.value.type !== "Literal" ||
    typeof name.value.value !== "string"
  ) {
    throw new Error(
      `Plugin-like object in ${path} must declare a literal meta.name`,
    );
  }
  return name.value.value;
}

export function discoverPluginGroups(
  sources: Readonly<Record<string, string>>,
): ReadonlyMap<string, string> {
  const plugins = new Map<string, string>();
  for (const [path, source] of Object.entries(sources)) {
    const result = parseSync(path, source);
    if (result.errors.length > 0) {
      throw new Error(`Could not parse upstream source ${path}`);
    }
    new Visitor({
      ObjectExpression(node) {
        const name = pluginName(node, path);
        if (name !== null) {
          const previous = plugins.get(name);
          if (previous !== undefined) {
            throw new Error(
              `Upstream plugin ${name} is defined in both ${previous} and ${path}`,
            );
          }
          plugins.set(name, path);
        }
      },
    }).visit(result.program);
  }
  return plugins;
}
