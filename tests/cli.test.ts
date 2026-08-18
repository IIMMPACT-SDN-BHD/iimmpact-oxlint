import { afterEach, describe, expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const directories: string[] = [];
const cli = resolve(import.meta.dir, "../src/cli.ts");

function temporaryDirectory(): string {
  const directory = mkdtempSync(resolve(tmpdir(), "iimmpact-oxlint-cli-test-"));
  directories.push(directory);
  return directory;
}

function run(args: string[], cwd: string) {
  return Bun.spawnSync(["bun", cli, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
}

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("CLI", () => {
  test("lists preset rules and severities", () => {
    const result = run(["rules", "--preset=base"], temporaryDirectory());
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain(
      "error anti-slop/no-module-mocking",
    );
    expect(result.stdout.toString()).toContain("15 rules (base)");
  });

  test("requires a value after --preset", () => {
    const result = run(["rules", "--preset"], temporaryDirectory());
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("--preset requires a value");
  });

  test("initializes once and requires force to overwrite", () => {
    const cwd = temporaryDirectory();
    const first = run(["init", "--preset=effect"], cwd);
    expect(first.exitCode).toBe(0);
    expect(readFileSync(resolve(cwd, "oxlint.config.ts"), "utf8")).toContain(
      'presets["effect"]',
    );
    expect(run(["init"], cwd).exitCode).toBe(1);
    expect(run(["init", "--preset=full", "--force"], cwd).exitCode).toBe(0);
  });

  test("warns when replacing a vendored anti-slop setup", () => {
    const cwd = temporaryDirectory();
    mkdirSync(resolve(cwd, "anti-slop"));
    writeFileSync(resolve(cwd, "oxlint.config.ts"), "export default {};\n");
    const result = run(["init", "--force"], cwd);
    expect(result.stderr.toString()).toContain("vendored anti-slop");
  });

  test("recognizes every supported config name without creating a second config", () => {
    for (const name of [".oxlintrc.jsonc", "oxlint.config.mts"]) {
      const cwd = temporaryDirectory();
      writeFileSync(resolve(cwd, name), "{}\n");
      expect(run(["init"], cwd).exitCode).toBe(1);
      expect(run(["init", "--force"], cwd).exitCode).toBe(0);
      expect(() => readFileSync(resolve(cwd, name), "utf8")).toThrow();
      expect(readFileSync(resolve(cwd, "oxlint.config.ts"), "utf8")).toContain(
        'presets["base"]',
      );
    }
  });

  test("detects the repository vendored anti-slop path", () => {
    const cwd = temporaryDirectory();
    mkdirSync(resolve(cwd, "tools/oxlint/anti-slop"), { recursive: true });
    const result = run(["init"], cwd);
    expect(result.exitCode).toBe(0);
    expect(result.stderr.toString()).toContain("vendored anti-slop");
  });

  test("cleans up generated check config before returning failure", () => {
    const cwd = temporaryDirectory();
    writeFileSync(
      resolve(cwd, "bad.ts"),
      "export function bad(value: unknown): unknown { return value; }\n",
    );
    const before = new Set(
      readdirSync(tmpdir()).filter((name) =>
        name.startsWith("iimmpact-oxlint-"),
      ),
    );
    expect(run(["check", "bad.ts"], cwd).exitCode).not.toBe(0);
    const added = readdirSync(tmpdir()).filter(
      (name) => name.startsWith("iimmpact-oxlint-") && !before.has(name),
    );
    expect(added).toEqual([]);
  });
});
