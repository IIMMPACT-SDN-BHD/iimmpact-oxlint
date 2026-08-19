# @iimmpact-sdn-bhd/oxlint

Curated Oxlint plugins and presets for IIMMPACT TypeScript repositories. The package combines general anti-slop rules, an opt-in anti-slop Effect group, type-aware TypeScript discipline rules, and Effect architecture rules while retaining their upstream namespaces.

## Install

Pin the package so the rules and bundled Oxlint executable move together:

```sh
bun add --dev @iimmpact-sdn-bhd/oxlint@0.3.0
```

Node.js 22.18 or newer is required. `oxlint` and `@oxlint/plugins` are both pinned to `1.78.0`; `oxlint-tsgolint` is pinned to `7.0.2001`. Published packages contain compiled JavaScript plugins; consumers do not execute TypeScript plugin source.

## Profiles

| Preset       | Contents                                                       |
| ------------ | -------------------------------------------------------------- |
| `base`       | All generic anti-slop and TypeScript discipline rules          |
| `effect`     | `base`, anti-slop Effect rules, and the Effect core preset     |
| `effect-web` | `effect` plus the additional Effect web rules                  |
| `full`       | `base`, anti-slop Effect rules, and every upstream Effect rule |

Effect severities are preserved from the upstream full preset; anti-slop and TypeScript discipline rules are errors. Every preset enables type-aware linting. External input must be decoded before it enters application functions; use narrow file-scoped exceptions when an integration contract requires manual `unknown` or `typeof` handling.

> **Choose Effect profiles intentionally.** `full`, and especially its Effect/web rules, enforce architecture policies rather than only identifying correctness defects. Adopt them when the repository has agreed to those constraints, not as an automatic upgrade from `base`.

## Configuration

```ts
// oxlint.config.ts
import { presets } from "@iimmpact-sdn-bhd/oxlint";

export default presets.base;
```

Exports are deliberately small: `presets`, named `base`, `effect`, `effectWeb`, and `full` presets, `getPreset`, and `withExceptions`. Plugin entrypoints are available at `@iimmpact-sdn-bhd/oxlint/anti-slop`, `@iimmpact-sdn-bhd/oxlint/anti-slop-effect`, and `@iimmpact-sdn-bhd/oxlint/effect` for tools that need them directly.

Use narrow file-scoped exceptions without mutating defaults:

```ts
import { full, withExceptions } from "@iimmpact-sdn-bhd/oxlint";

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

[`upstream.lock.json`](upstream.lock.json) pins provenance commits. [`rules.manifest.json`](rules.manifest.json) derives rule inventories and preset counts from the vendored plugin/config sources and the curated TypeScript discipline inventory. Build assertions require complete, non-overlapping plugin inventories and consistent upstream preset unions. Sync stops when upstream introduces an unmapped plugin group instead of silently shipping dormant rules.

A weekly and manually dispatched workflow mirrors only allowlisted source paths from both upstream default branches, regenerates provenance/manifests, runs the full checks, and creates or updates a pull request. It requests GitHub auto-merge after required checks rather than writing directly to `main`. Any upstream license change stops synchronization for manual review.

Version tags publish the matching package through npm trusted publishing with provenance. Consumer repositories remain on their exact pinned version until they deliberately upgrade.

Maintainers can run:

```sh
bun run sync:upstream       # update snapshots
bun run sync:check          # compare snapshots to current upstream heads
```

## Attribution and licenses

Package glue is MIT licensed. Vendored implementations retain their upstream MIT licenses under `vendor/anti-slop/LICENSE` and `vendor/oxc-effect/LICENSE`. See [`NOTICE.md`](NOTICE.md), [`vendor/README.md`](vendor/README.md), and the provenance lock for exact sources and commits.
