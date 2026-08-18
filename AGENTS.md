# Contributor conventions

- Use Bun and exact dependency versions. Do not replace the lightweight Bun/TypeScript build with upstream project tooling.
- Treat `vendor/` as read-only source snapshots. Never format, refactor, or patch vendored rules directly.
- Put IIMMPACT wrappers, exceptions, tests, and compatibility changes under `src/`, `scripts/`, or `tests/`.
- Update upstreams only through `bun run sync:upstream`. Its allowlist must stay narrow, provenance SHAs must be updated, and license changes require manual review.
- Derive rule lists from vendored entries/configs with `scripts/generate-manifest.ts`; do not hand-maintain duplicate rule inventories.
- Keep every relevant rule active by default. Exceptions must be narrow, explicit, and outside vendored source.
- Before proposing a change, run `bun run check`. Do not commit generated `dist/` output.
- Do not commit, publish, or push unless explicitly authorized.
