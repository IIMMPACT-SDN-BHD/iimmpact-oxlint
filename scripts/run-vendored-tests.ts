const tests = [
  ...(await Array.fromAsync(
    new Bun.Glob("vendor/anti-slop/src/rules/*.test.ts").scan({
      cwd: import.meta.dir + "/..",
      absolute: true,
    }),
  )),
  import.meta.dir + "/../tests/anti-slop-missing-upstream.test.ts",
].sort();

const nodeVersion = Bun.spawnSync(["node", "-p", "process.versions.node"], {
  stdout: "pipe",
  stderr: "inherit",
});
if (nodeVersion.exitCode !== 0) process.exit(nodeVersion.exitCode);
const nodeMajor = Number(nodeVersion.stdout.toString().trim().split(".")[0]);

if (nodeMajor < 22) {
  console.log("Skipping RuleTester files because Oxlint requires Node 22+");
  process.exit(0);
}

for (const test of tests) {
  const result = Bun.spawnSync(["node", "--experimental-strip-types", test], {
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) process.exit(result.exitCode);
}

console.log(`Passed ${tests.length} anti-slop rule test files`);
