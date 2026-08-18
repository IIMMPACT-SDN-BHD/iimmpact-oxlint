#!/usr/bin/env bun
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lock = JSON.parse(
  await readFile(resolve(root, "upstream.lock.json"), "utf8"),
) as {
  schemaVersion: number;
  upstreams: Record<
    string,
    { repository: string; defaultBranch: string; sha: string; paths: string[] }
  >;
};
const expected = {
  "anti-slop": { branch: "main", paths: ["LICENSE", "src"] },
  "oxc-effect": {
    branch: "master",
    paths: ["LICENSE", "plugin.js", "lib", "rules", "configs"],
  },
} as const;
const legalNames = new Set([
  "license",
  "license.md",
  "notice",
  "notice.md",
  "copying",
  "copying.md",
]);

function run(command: string[], cwd = root): string {
  const result = Bun.spawnSync(command, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0)
    throw new Error(
      `${command.join(" ")} failed:\n${result.stderr.toString()}`,
    );
  return result.stdout.toString().trim();
}
function equal(left: string, right: string): boolean {
  return (
    Bun.spawnSync(["diff", "-qr", left, right], {
      stdout: "pipe",
      stderr: "pipe",
    }).exitCode === 0
  );
}

if (lock.schemaVersion !== 1)
  throw new Error(`Unsupported lock schema ${lock.schemaVersion}`);
const temporaryDirectory = await mkdtemp(resolve(root, ".vendor-verify-"));
try {
  for (const [name, policy] of Object.entries(expected)) {
    const upstream = lock.upstreams[name];
    if (
      !upstream ||
      upstream.defaultBranch !== policy.branch ||
      !/^[0-9a-f]{40}$/.test(upstream.sha)
    )
      throw new Error(`${name} has invalid branch or SHA provenance`);
    if (JSON.stringify(upstream.paths) !== JSON.stringify(policy.paths))
      throw new Error(`${name} allowlist differs from the enforced policy`);
    const remoteHead = run([
      "git",
      "ls-remote",
      "--symref",
      upstream.repository,
      "HEAD",
    ]);
    if (!remoteHead.startsWith(`ref: refs/heads/${policy.branch}\tHEAD`))
      throw new Error(`${name} remote default branch is not ${policy.branch}`);

    const clone = resolve(temporaryDirectory, name);
    run([
      "git",
      "clone",
      "--quiet",
      "--filter=blob:none",
      "--no-checkout",
      "--single-branch",
      "--branch",
      policy.branch,
      upstream.repository,
      clone,
    ]);
    run(["git", "fetch", "--quiet", "origin", upstream.sha], clone);
    run(
      [
        "git",
        "merge-base",
        "--is-ancestor",
        upstream.sha,
        `origin/${policy.branch}`,
      ],
      clone,
    );
    run(["git", "checkout", "--quiet", "--detach", upstream.sha], clone);
    if (run(["git", "rev-parse", "HEAD"], clone) !== upstream.sha)
      throw new Error(`${name} fetched SHA does not match lock`);
    const legal = run(["git", "ls-files"], clone)
      .split("\n")
      .filter((path) => legalNames.has(basename(path).toLowerCase()));
    if (legal.length !== 1 || legal[0] !== "LICENSE")
      throw new Error(
        `${name} has unexpected legal files: ${legal.join(", ")}`,
      );
    const expectedTopLevel = [
      ...new Set(policy.paths.map((path) => path.split("/")[0])),
    ].sort();
    const actualTopLevel = (
      await readdir(resolve(root, "vendor", name))
    ).sort();
    if (JSON.stringify(actualTopLevel) !== JSON.stringify(expectedTopLevel))
      throw new Error(
        `${name} vendor root differs from allowlist: ${actualTopLevel.join(", ")}`,
      );
    for (const path of policy.paths) {
      if (!equal(resolve(clone, path), resolve(root, "vendor", name, path)))
        throw new Error(
          `${name}/${path} differs from locked SHA ${upstream.sha}`,
        );
    }
  }
  console.log("Vendored snapshots exactly match locked upstream SHAs");
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
