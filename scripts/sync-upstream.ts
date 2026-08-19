#!/usr/bin/env bun
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

import { discoverPluginGroups } from "./upstream-plugin-groups.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const legalNames = new Set([
  "license",
  "license.md",
  "notice",
  "notice.md",
  "copying",
  "copying.md",
]);
const integratedPluginGroups: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = {
  "anti-slop": {
    "anti-slop": "src/index.ts",
    "anti-slop-effect": "src/effect/index.ts",
  },
};

interface Upstream {
  repository: string;
  defaultBranch: string;
  sha: string;
  paths: string[];
}
interface LockFile {
  schemaVersion: number;
  upstreams: Record<string, Upstream>;
}

function run(
  command: string[],
  cwd = root,
  env?: Record<string, string>,
): string {
  const result = Bun.spawnSync(command, {
    cwd,
    env: env ? { ...process.env, ...env } : undefined,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0)
    throw new Error(
      `${command.join(" ")} failed:\n${result.stderr.toString()}`,
    );
  return result.stdout.toString().trim();
}

async function same(left: string, right: string): Promise<boolean> {
  return (
    Bun.spawnSync(["diff", "-qr", left, right], {
      stdout: "ignore",
      stderr: "ignore",
    }).exitCode === 0
  );
}

function assertLegalFiles(clone: string, name: string): void {
  const legal = run(["git", "ls-files"], clone)
    .split("\n")
    .filter((path) => legalNames.has(basename(path).toLowerCase()));
  if (legal.length !== 1 || legal[0] !== "LICENSE") {
    throw new Error(
      `${name} legal files changed (${legal.join(", ") || "none"}); manual legal review is required`,
    );
  }
}

async function assertIntegratedPluginGroups(
  clone: string,
  name: string,
): Promise<void> {
  const expected = integratedPluginGroups[name];
  if (expected === undefined) return;

  const sourcePaths = run(["git", "ls-files", "src"], clone)
    .split("\n")
    .filter((path) => /\.[cm]?[jt]sx?$/u.test(path));
  const sources: Record<string, string> = {};
  for (const path of sourcePaths) {
    sources[path] = await readFile(resolve(clone, path), "utf8");
  }
  const actual = discoverPluginGroups(sources);

  const unintegrated = [...actual].filter(
    ([plugin, path]) => expected[plugin] !== path,
  );
  const missing = Object.entries(expected).filter(
    ([plugin, path]) => actual.get(plugin) !== path,
  );
  if (unintegrated.length > 0 || missing.length > 0) {
    throw new Error(
      `${name} plugin groups changed; unintegrated: ${unintegrated.map(([plugin, path]) => `${plugin} at ${path}`).join(", ") || "none"}; missing: ${missing.map(([plugin, path]) => `${plugin} at ${path}`).join(", ") || "none"}`,
    );
  }
}

const lockPath = resolve(root, "upstream.lock.json");
const lock = JSON.parse(await readFile(lockPath, "utf8")) as LockFile;
const temporaryDirectory = await mkdtemp(resolve(root, ".sync-upstream-"));
const stagedRoot = resolve(temporaryDirectory, "staged");
let drift = false;

try {
  await mkdir(resolve(stagedRoot, "vendor"), { recursive: true });
  for (const [name, upstream] of Object.entries(lock.upstreams)) {
    const clone = resolve(temporaryDirectory, `clone-${name}`);
    run([
      "git",
      "clone",
      "--quiet",
      "--depth=1",
      "--branch",
      upstream.defaultBranch,
      "--single-branch",
      upstream.repository,
      clone,
    ]);
    const sha = run(["git", "rev-parse", "HEAD"], clone);
    const branch = run(["git", "branch", "--show-current"], clone);
    if (branch !== upstream.defaultBranch)
      throw new Error(
        `${name} checked out ${branch}, expected ${upstream.defaultBranch}`,
      );
    assertLegalFiles(clone, name);
    await assertIntegratedPluginGroups(clone, name);

    const currentVendor = resolve(root, "vendor", name);
    const stagedVendor = resolve(stagedRoot, "vendor", name);
    await mkdir(stagedVendor, { recursive: true });
    if (
      !(await same(
        resolve(clone, "LICENSE"),
        resolve(currentVendor, "LICENSE"),
      ))
    ) {
      throw new Error(
        `${name} changed LICENSE; review licensing manually before updating the snapshot`,
      );
    }
    for (const path of upstream.paths) {
      const source = resolve(clone, path);
      const current = resolve(currentVendor, path);
      if (!(await same(source, current))) {
        drift = true;
        console.log(`${name}: ${path} differs at ${sha}`);
      }
      if (!checkOnly)
        await cp(source, resolve(stagedVendor, path), {
          recursive: true,
          preserveTimestamps: true,
        });
    }
    if (!checkOnly) {
      upstream.sha = sha;
      upstream.defaultBranch = branch;
    }
  }

  if (checkOnly) {
    if (drift)
      throw new Error(
        "Vendored sources are behind upstream; run bun run sync:upstream",
      );
    console.log("Vendored snapshots match current upstream default branches");
  } else {
    await writeFile(
      resolve(stagedRoot, "upstream.lock.json"),
      await format(JSON.stringify(lock), { parser: "json" }),
    );
    const anti = lock.upstreams["anti-slop"];
    const effect = lock.upstreams["oxc-effect"];
    await writeFile(
      resolve(stagedRoot, "NOTICE.md"),
      `# Third-party notices\n\nThis distribution contains unmodified source snapshots from:\n\n- **anti-slop**, Copyright Dillon Mulroy and contributors, MIT License. Source: ${anti.repository.replace(".git", "")}/tree/${anti.sha}\n- **oxc-effect-linting-rules**, Copyright Roman Naumenko and contributors, MIT License. Source: ${effect.repository.replace(".git", "")}/tree/${effect.sha}\n\nThe complete upstream license texts are retained beside each snapshot under \`vendor/\`. IIMMPACT glue, presets, tests, and tooling are licensed under the root MIT license.\n`,
    );
    run(["bun", "scripts/generate-manifest.ts"], root, {
      MANIFEST_SOURCE_ROOT: stagedRoot,
      MANIFEST_OUTPUT_ROOT: stagedRoot,
    });

    const outputs = [
      "vendor/anti-slop",
      "vendor/oxc-effect",
      "upstream.lock.json",
      "NOTICE.md",
      "rules.manifest.json",
      "src/generated/manifests.ts",
    ];
    const backupRoot = resolve(temporaryDirectory, "backup");
    await mkdir(backupRoot, { recursive: true });
    const backedUp: string[] = [];
    try {
      for (const path of outputs) {
        const target = resolve(root, path);
        const backup = resolve(backupRoot, path);
        await mkdir(dirname(backup), { recursive: true });
        await rename(target, backup);
        backedUp.push(path);
        await mkdir(dirname(target), { recursive: true });
        await rename(resolve(stagedRoot, path), target);
      }
    } catch (error) {
      for (const path of backedUp.reverse()) {
        await rm(resolve(root, path), { recursive: true, force: true });
        await rename(resolve(backupRoot, path), resolve(root, path));
      }
      throw error;
    }
    console.log(
      drift
        ? "Updated vendored snapshots and provenance"
        : "Vendored snapshots already current",
    );
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
