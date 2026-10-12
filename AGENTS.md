# AGENTS.md

## Commands

- `npm test` — run the full test suite

## Code Map

- `src` — application source (`bnet.js` API client, `talents.js` loadout codec)
- `test` — automated tests
- `scripts` — maintenance scripts (wiki rebuild, talent-string encode/decode/check)
- `builds` — per-spec talent builds: `<specId>.md` guide, `<specId>.json` node map

## Conventions

- Use ESM `import`/`export` with explicit `.js` extensions.
- Place runnable query examples under `examples/`.
