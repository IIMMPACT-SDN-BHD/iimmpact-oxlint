# Vendored upstream sources

These directories are exact, allowlisted source snapshots. Do not format or edit them by hand.

- `anti-slop/`: `LICENSE` and `src/` from `dmmulroy/anti-slop`.
- `oxc-effect/`: `LICENSE`, `plugin.js`, `lib/`, `rules/`, and `configs/` from `shekohex/oxc-effect-linting-rules`.

Pinned commits and source URLs are in [`../upstream.lock.json`](../upstream.lock.json). Run `bun run sync:upstream` to mirror both current default branches. Local integration, exceptions, manifests, and tests belong outside this directory.
