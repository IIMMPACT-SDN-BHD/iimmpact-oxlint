# @iimmpact/oxlint

Curated Oxlint plugins and presets for IIMMPACT TypeScript repositories. The package combines 15 general anti-slop rules with 72 Effect architecture rules while retaining their original `anti-slop/*` and `effect/*` namespaces.

## Install

Pin the package so the rules and bundled Oxlint executable move together:

```sh
bun add --dev @iimmpact/oxlint@0.1.0
```

Node.js 22.18 or newer is required. `oxlint` and `@oxlint/plugins` are both pinned to `1.78.0`. Published packages contain compiled JavaScript plugins; consumers do not execute TypeScript plugin source.

## Profiles

| Preset       | Rules | Contents                                                          |
| ------------ | ----: | ----------------------------------------------------------------- |
| `base`       |    15 | All anti-slop rules, all errors                                   |
| `effect`     |    76 | `base` plus the 61-rule upstream Effect core preset               |
| `effect-web` |    81 | `effect` plus the five additional web rules (six web rules total) |
| `full`       |    87 | All 15 anti-slop and all 72 Effect rules                          |

Effect severities are preserved from the upstream full preset; anti-slop rules are errors.

> **Choose Effect profiles intentionally.** `full`, and especially its Effect/web rules, enforce architecture policies rather than only identifying correctness defects. Adopt them when the repository has agreed to those constraints, not as an automatic upgrade from `base`.

## Configuration

```ts
// oxlint.config.ts
import { presets } from "@iimmpact/oxlint";

export default presets.base;
```

Exports are deliberately small: `presets`, named `base`, `effect`, `effectWeb`, and `full` presets, `getPreset`, and `withExceptions`. Plugin entrypoints are available at `@iimmpact/oxlint/anti-slop` and `@iimmpact/oxlint/effect` for tools that need them directly.

Use narrow file-scoped exceptions without mutating defaults:

```ts
import { full, withExceptions } from "@iimmpact/oxlint";

export default withExceptions(full, [
  {
    files: ["src/generated/**"],
    rules: { "anti-slop/no-shape-in-symbol-names": "off" },
  },
]);
```

No broad exceptions are enabled by default.

## CLI

The CLI resolves this package's pinned Oxlint and uses temporary configuration with package-local absolute plugin paths:

```sh
bunx iimmpact-oxlint check src tests --preset=base
bunx iimmpact-oxlint init --preset=effect
bunx iimmpact-oxlint rules --preset=full
```

`check` defaults to the current directory and `base`. `init` creates `oxlint.config.ts` only if no known config exists; pass `--force` to replace one. It warns when a likely vendored anti-slop installation already exists. The compiled binary works under Node.js and Bun.

## Upstream policy

[`upstream.lock.json`](upstream.lock.json) pins provenance commits. [`rules.manifest.json`](rules.manifest.json) is generated from the vendored plugin/config sources and build assertions enforce exactly 15 anti-slop rules, 72 Effect rules, 87 total rules, and consistent upstream preset unions.

A weekly and manually dispatched workflow mirrors only allowlisted source paths from both upstream default branches, regenerates provenance/manifests, runs the full checks, and creates or updates a pull request. It requests GitHub auto-merge after required checks rather than writing directly to `main`. Any upstream license change stops synchronization for manual review.

Version tags publish the matching package through npm trusted publishing with provenance. Consumer repositories remain on their exact pinned version until they deliberately upgrade.

Maintainers can run:

```sh
bun run sync:upstream       # update snapshots
bun run sync:check          # compare snapshots to current upstream heads
```

## Attribution and licenses

Package glue is MIT licensed. Vendored implementations retain their upstream MIT licenses under `vendor/anti-slop/LICENSE` and `vendor/oxc-effect/LICENSE`. See [`NOTICE.md`](NOTICE.md), [`vendor/README.md`](vendor/README.md), and the provenance lock for exact sources and commits.
