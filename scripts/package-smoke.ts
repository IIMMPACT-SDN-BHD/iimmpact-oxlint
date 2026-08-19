import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const temporaryBase = resolve(homedir(), ".cache/agent-tmp");
await mkdir(temporaryBase, { recursive: true });
const temporaryDirectory = await mkdtemp(
  resolve(temporaryBase, "iimmpact-oxlint-smoke-"),
);

function run(command: string[], cwd: string): string {
  const result = Bun.spawnSync(command, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0)
    throw new Error(
      `${command.join(" ")} failed:\n${result.stderr.toString()}`,
    );
  return result.stdout.toString();
}

try {
  run(["bun", "pm", "pack", "--destination", temporaryDirectory], root);
  const tarball = (await readdir(temporaryDirectory)).find((file) =>
    file.endsWith(".tgz"),
  );
  if (!tarball) throw new Error("bun pm pack did not produce a tarball");
  const packedFiles = new Set(
    run(["tar", "-tzf", resolve(temporaryDirectory, tarball)], root)
      .trim()
      .split("\n")
      .map((path) => path.replace(/^package\//, "")),
  );
  const expectedFiles = [
    "package.json",
    "README.md",
    "LICENSE",
    "NOTICE.md",
    "upstream.lock.json",
    "rules.manifest.json",
    "vendor/README.md",
    "vendor/anti-slop/LICENSE",
    "vendor/oxc-effect/LICENSE",
    "dist/index.js",
    "dist/index.d.ts",
    "dist/cli.js",
    "dist/exceptions.d.ts",
    "dist/generated/manifests.d.ts",
    "dist/plugins/anti-slop.js",
    "dist/plugins/anti-slop.d.ts",
    "dist/plugins/anti-slop-effect.js",
    "dist/plugins/anti-slop-effect.d.ts",
    "dist/plugins/effect.js",
    "dist/plugins/effect.d.ts",
  ];
  const missingFiles = expectedFiles.filter((path) => !packedFiles.has(path));
  if (missingFiles.length > 0)
    throw new Error(`Packed tarball is missing: ${missingFiles.join(", ")}`);

  const consumer = resolve(temporaryDirectory, "consumer");
  await mkdir(consumer);
  await writeFile(
    resolve(consumer, "package.json"),
    '{"private":true,"type":"module"}\n',
  );
  run(["bun", "add", resolve(temporaryDirectory, tarball)], consumer);
  await writeFile(
    resolve(consumer, "consumer.ts"),
    'import { full, withExceptions } from "@iimmpact-sdn-bhd/oxlint";\nimport antiSlop from "@iimmpact-sdn-bhd/oxlint/anti-slop";\nimport antiSlopEffect from "@iimmpact-sdn-bhd/oxlint/anti-slop-effect";\nimport effect from "@iimmpact-sdn-bhd/oxlint/effect";\nconst configured = withExceptions({ ...full, customField: "preserved" as const }, []);\nconst preserved: "preserved" = configured.customField;\nconst counts: number[] = [Object.keys(antiSlop.rules).length, Object.keys(antiSlopEffect.rules).length, Object.keys(effect.rules).length];\nconsole.log(preserved, counts);\n',
  );
  await writeFile(
    resolve(consumer, "tsconfig.json"),
    '{"compilerOptions":{"strict":true,"noEmit":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","skipLibCheck":false},"include":["consumer.ts"]}\n',
  );
  run(
    [resolve(root, "node_modules/.bin/tsc"), "-p", "tsconfig.json"],
    consumer,
  );
  run(
    [
      "node",
      "--input-type=module",
      "--eval",
      'const root=await import("@iimmpact-sdn-bhd/oxlint"); const anti=await import("@iimmpact-sdn-bhd/oxlint/anti-slop"); const antiEffect=await import("@iimmpact-sdn-bhd/oxlint/anti-slop-effect"); const effect=await import("@iimmpact-sdn-bhd/oxlint/effect"); const included=(plugin,prefix,preset)=>Object.keys(plugin.default.rules).every(name=>preset.rules[`${prefix}/${name}`]); if(!included(anti,"anti-slop",root.base)||!included(antiEffect,"anti-slop-effect",root.effect)||!included(effect,"effect",root.full)||root.base.rules["anti-slop-effect/no-service-constructor-imports"]!==undefined||root.full.options?.typeAware!==true) process.exit(1)',
    ],
    consumer,
  );
  const output = run(
    [
      resolve(consumer, "node_modules/.bin/iimmpact-oxlint"),
      "rules",
      "--preset=full",
    ],
    consumer,
  );
  const manifest = JSON.parse(
    await readFile(
      resolve(
        consumer,
        "node_modules/@iimmpact-sdn-bhd/oxlint/rules.manifest.json",
      ),
      "utf8",
    ),
  ) as { counts: { full: number } };
  if (!output.includes(`${manifest.counts.full} rules (full)`))
    throw new Error("Packed CLI did not load the full preset");
  await writeFile(
    resolve(consumer, "clean.ts"),
    'export const greeting: string = "hello";\n',
  );
  await writeFile(
    resolve(consumer, "oxlint.config.ts"),
    'import { presets } from "@iimmpact-sdn-bhd/oxlint";\nexport default presets.base;\n',
  );
  run(
    [
      resolve(consumer, "node_modules/.bin/oxlint"),
      "--config",
      "oxlint.config.ts",
      "clean.ts",
    ],
    consumer,
  );
  run(
    [
      resolve(consumer, "node_modules/.bin/iimmpact-oxlint"),
      "check",
      "clean.ts",
      "--preset=base",
    ],
    consumer,
  );
  console.log("Packed tarball imports and CLI smoke test passed");
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
