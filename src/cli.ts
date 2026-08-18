#!/usr/bin/env node
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { getPreset, type PresetName } from "./index.js";

const validPresets = ["base", "effect", "effect-web", "full"] as const;

class CliError extends Error {}

function fail(message: string): never {
  throw new CliError(message);
}

function parsePreset(args: string[]): { preset: PresetName; rest: string[] } {
  let preset: PresetName = "base";
  const rest: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = argument.startsWith("--preset=")
      ? argument.slice("--preset=".length)
      : argument === "--preset"
        ? args[++index]
        : undefined;
    if (argument === "--preset" && value === undefined)
      fail("--preset requires a value");
    if (value === undefined) rest.push(argument);
    else if (validPresets.includes(value as PresetName))
      preset = value as PresetName;
    else
      fail(
        `unknown preset ${JSON.stringify(value)}; choose ${validPresets.join(", ")}`,
      );
  }
  return { preset, rest };
}

function packageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

function absoluteConfig(name: PresetName) {
  const preset = getPreset(name);
  const root = packageRoot();
  return {
    ...preset,
    jsPlugins: preset.jsPlugins.map((plugin) => ({
      ...plugin,
      specifier: resolve(root, `dist/plugins/${plugin.name}.js`),
    })),
  };
}

function runCheck(name: PresetName, paths: string[]): number {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "iimmpact-oxlint-"));
  const configPath = join(temporaryDirectory, "oxlint.json");
  writeFileSync(configPath, JSON.stringify(absoluteConfig(name)));
  try {
    const require = createRequire(import.meta.url);
    const packageJson = require.resolve("oxlint/package.json");
    const executable = resolve(dirname(packageJson), "bin/oxlint");
    const result = spawnSync(
      process.execPath,
      [executable, "--config", configPath, ...(paths.length ? paths : ["."])],
      {
        stdio: "inherit",
      },
    );
    if (result.error)
      fail(`could not start pinned Oxlint: ${result.error.message}`);
    return result.status ?? 1;
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function existingConfigs(): string[] {
  return [
    "oxlint.config.ts",
    "oxlint.config.mts",
    "oxlint.config.cts",
    "oxlint.config.js",
    "oxlint.config.mjs",
    "oxlint.config.cjs",
    ".oxlintrc.json",
    ".oxlintrc.jsonc",
  ].filter(existsSync);
}

function init(name: PresetName, force: boolean): void {
  const existing = existingConfigs();
  if (existing.length > 0 && !force)
    fail(
      `configuration already exists (${existing.join(", ")}); use --force to overwrite`,
    );

  const vendoredCandidates = [
    "anti-slop",
    ".oxlint/anti-slop",
    "plugins/anti-slop",
    "tools/oxlint/anti-slop",
  ];
  const configuredVendored = existing.some((path) =>
    readFileSync(path, "utf8").includes("anti-slop"),
  );
  if (configuredVendored || vendoredCandidates.some(existsSync)) {
    console.warn(
      "warning: an existing vendored anti-slop plugin was detected; remove it after verifying this package preset",
    );
  }

  for (const existingPath of existing) {
    if (existingPath !== "oxlint.config.ts") rmSync(existingPath);
  }
  const path = "oxlint.config.ts";
  writeFileSync(
    path,
    `import { presets } from "@iimmpact/oxlint";\n\nexport default presets[${JSON.stringify(name)}];\n`,
  );
  console.log(`wrote ${path} using the ${name} preset`);
}

function listRules(name: PresetName): void {
  const entries = Object.entries(getPreset(name).rules).sort(
    ([left], [right]) => left.localeCompare(right),
  );
  for (const [rule, severity] of entries)
    console.log(`${severity.padEnd(5)} ${rule}`);
  console.log(`\n${entries.length} rules (${name})`);
}

function main(): number {
  const [command, ...rawArgs] = process.argv.slice(2);
  const { preset, rest } = parsePreset(rawArgs);
  switch (command) {
    case "check":
      return runCheck(preset, rest);
    case "init":
      init(preset, rest.includes("--force"));
      return 0;
    case "rules":
      listRules(preset);
      return 0;
    default:
      console.error(
        "Usage: iimmpact-oxlint <check [paths...]|init|rules> [--preset=base|effect|effect-web|full] [--force]",
      );
      return command === "--help" || command === "-h" ? 0 : 1;
  }
}

try {
  process.exitCode = main();
} catch (error) {
  if (error instanceof CliError) {
    console.error(`iimmpact-oxlint: ${error.message}`);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
