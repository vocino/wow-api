# wow-api

Local-only Battle.net World of Warcraft API queries. Zero dependencies, Node 18+.

## Setup

1. Create an API client at <https://develop.battle.net/access/clients>
   (redirect URI `http://localhost` is fine; the secret is shown once).
2. Put the credentials in `.env` (git-ignored, never committed):
   ```text
   BNET_ID=<client-id>
   BNET_SECRET=<client-secret>
   ```

## Usage

```powershell
node examples/classes.js             # class + spec ids
node examples/spec-toolkit.js 267    # Destruction Warlock talents + spell ids
node examples/spell.js 116858        # Chaos Bolt details
```

`.env` in the working directory is loaded automatically; real
environment variables take precedence. Optional: `BNET_REGION=eu`
(default `us`).

## Worked example: Destruction SBA abilities

Single-Button Assistant cycles the spec's single-target rotation
(Icy Veins Easy Mode guide, Midnight Season 1). Resolve it to spell
data like this:

1. `node examples/spec-toolkit.js 267` — confirms the talent-gated
   members and ids: Chaos Bolt 116858, Conflagrate 17962, Cataclysm
   152108, Summon Infernal 1122.
2. `node examples/spell.js <id>` — details for each ability.
   Baseline spells are not in the talent trees, so look them up
   directly: Immolate 348, Incinerate 29722.

Result: Summon Infernal, Immolate, Chaos Bolt, Conflagrate,
Cataclysm, Incinerate. The SBA priority order itself is in-game
only (Blizzard APLs), not a web endpoint.

## Tests

```powershell
npm test
```
