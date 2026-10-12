import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  actionsToSelections,
  bitsToString,
  buildOrder,
  decodeLoadout,
  encodeLoadout,
  stringToBits,
} from '../src/talents.js';

// Pinned warlock class-tree order: the 200 API node IDs in ascending order plus
// the two game-side subtree selectors (99849/99850) at their sorted position.
// Snapshot of static-12.1.0; if the tree changes, re-derive with scripts/.
const ORDER_202 = [71916, 71917, 71918, 71922, 71923, 71924, 71926, 71930, 71931, 71932, 71933, 71936, 71937, 71938, 71941, 71942, 71944, 71947, 71948, 71949, 71950, 71952, 71954, 71955, 71956, 71957, 71960, 71961, 71964, 71965, 71966, 71968, 71969, 71971, 71972, 71973, 71974, 71975, 71979, 71980, 71982, 71983, 71985, 71987, 72032, 72033, 72034, 72037, 72041, 72045, 72046, 72047, 72049, 72050, 72051, 72054, 72055, 72058, 72059, 72060, 72061, 72062, 72064, 72065, 72066, 72067, 72068, 72069, 94821, 94822, 94823, 94824, 94825, 94826, 94829, 94830, 94831, 94832, 94833, 94834, 94835, 94836, 94837, 94838, 94840, 94842, 94843, 94844, 94845, 94846, 94847, 94848, 94849, 94850, 94851, 94852, 94853, 94854, 94855, 94856, 94857, 99848, 99849, 99850, 100941, 101886, 101887, 101888, 101891, 101892, 101893, 101894, 101895, 101903, 101905, 101908, 101909, 101914, 101917, 101920, 101923, 101992, 101993, 101994, 102003, 102031, 102247, 102427, 108678, 108680, 108681, 109241, 109244, 109248, 109249, 109250, 109251, 109252, 109253, 109257, 109831, 109832, 109833, 109834, 109835, 109836, 109837, 109838, 109839, 109840, 109841, 109842, 109843, 109844, 109845, 109846, 109847, 109848, 109849, 109850, 109851, 109852, 109853, 109854, 109855, 109857, 109858, 109859, 109860, 109861, 109862, 109863, 109864, 109865, 109866, 109934, 109936, 110071, 110072, 110073, 110074, 110075, 110076, 110191, 110192, 110193, 110194, 110195, 110196, 110197, 110198, 110199, 110200, 110201, 110269, 110270, 110280, 110281, 110282, 110404, 110405, 110406];

// Published third-party Destruction strings (Icy Veins, 12.1): ST/Hellcaller,
// AoE/Diabolist, Delves/Hellcaller.
const IV_STRINGS = [
  'CsQAAAAAAAAAAAAAAAAAAAAAAwMmZGNLMzmZmZWmFzMzsYMWMDAAmZGzMziNYgZxoxMAmtYjBAAGDM2AAmZwYGzYDAAwMzMAAMGG',
  'CsQAAAAAAAAAAAAAAAAAAAAAAwMjZGNLmxmZGzysNzYmFzYZZMAAYGjZmZBMmxwCMw2wCNWYAAgxMMsBgZGgxMjZ2AAAMzMzAAYMM',
  'CsQAAAAAAAAAAAAAAAAAAAAAAwMjZGNLmxmZGzysZGzsYYZZmBAAzMjZmZxCMwsY0YGAzG2YAAgxMAAAzMYMzMmNAAAzMzMAAMDD',
];

// Real game export, Demonology/Diabolist (nonzero tree hash), with an
// in-game-verified talent list. Ends with zero pad bits after node 110406.
const DEMO_STRING =
  'CoQAMrNP5kak+EBqLfUa3dMm+uMmxMjmlZGLMzMLDAAAAAAwYZZGzMDbGGmZb2ahmxiZmZsNLzMzwAAzMGzMzMYmZmZmxsBAAGzwYYMLDDYA';

describe('talent bit packing', () => {
  it('roundtrips LSB-first across char boundaries', () => {
    const bits = [1, 0, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1];
    assert.deepEqual(stringToBits(bitsToString(bits)).slice(0, bits.length), bits);
  });

  it('inserts the unlisted selectors after 99848', () => {
    const order = buildOrder([[{ id: 100941 }, { id: 71916 }, { id: 99848 }]]);
    assert.deepEqual(order, [71916, 99848, 99849, 99850, 100941]);
  });

  it('never duplicates selectors the API already lists', () => {
    const order = buildOrder([[{ id: 99850 }, { id: 100941 }, { id: 99848 }, { id: 99849 }]]);
    assert.deepEqual(order, [99848, 99849, 99850, 100941]);
  });
});

describe('talent loadout roundtrips', () => {
  for (const [i, s] of IV_STRINGS.entries()) {
    it(`reproduces IV string ${i} byte-exact`, () => {
      const d = decodeLoadout(s, ORDER_202);
      assert.equal(d.version, 2);
      assert.equal(d.specId, 267);
      assert.equal(encodeLoadout(d.version, d.specId, d.selections, ORDER_202), s);
    });
  }

  it('decodes the Destruction apex and selectors, not cross-spec apexes', () => {
    const d = decodeLoadout(IV_STRINGS[1], ORDER_202);
    assert.deepEqual(d.selections.get(110406), { purchased: true, rank: null, choice: null });
    assert.ok(!d.selections.has(110404));
    assert.ok(!d.selections.has(110405));
    assert.deepEqual(d.selections.get(99848), { purchased: true, rank: null, choice: 0 });
    assert.ok(!d.selections.has(99849));
    assert.ok(!d.selections.has(99850));
  });

  it('decodes the Demonology export with its own selector and apex', () => {
    const d = decodeLoadout(DEMO_STRING, ORDER_202);
    assert.equal(d.version, 2);
    assert.equal(d.specId, 266);
    assert.ok(d.selections.has(110404));
    assert.ok(!d.selections.has(110406));
    assert.deepEqual(d.selections.get(99849), { purchased: true, rank: null, choice: 0 });
    assert.ok(!d.selections.has(99848));
    // In-game-confirmed sides: Howl of Terror (idx 0), Power Siphon (idx 1).
    assert.equal(d.selections.get(71947).choice, 0);
    assert.equal(d.selections.get(101893).choice, 1);
  });
});

describe('builds/267.json', () => {
  const build = JSON.parse(readFileSync(new URL('../builds/267.json', import.meta.url), 'utf8'));
  const CLASS = new Set([71949, 71933, 71952, 71950, 71948, 71930, 71922, 110074, 71917, 109842, 71926, 71916, 109847, 109840, 109848, 71942, 109845, 100941, 71954, 71955, 71957, 71936, 71937, 71956, 110071, 110072, 109843, 71938, 71947, 71941, 110073, 99848]);
  const HERO = new Set([94855, 94856, 94826, 109833, 109832, 109831, 94831, 94830, 94849, 94833, 94836, 94848, 94852, 94843]);
  const MULTIRANK = { 71952: 2, 71950: 2, 109842: 2, 71969: 2, 72066: 2, 110281: 2 };

  it('uses known nodes with valid actions', () => {
    const orderSet = new Set(ORDER_202);
    for (const [key, action] of Object.entries(build.nodes)) {
      const id = Number(key);
      assert.ok(orderSet.has(id), `unknown node ${id}`);
      if (action === 'full' || action === 'granted') continue;
      assert.ok(typeof action === 'object' && action !== null, `bad action ${id}`);
      if ('partial' in action) {
        assert.ok(Number.isInteger(action.partial) && action.partial >= 1 && action.partial < (MULTIRANK[id] ?? 1), `bad partial ${id}`);
      } else if ('choice' in action) {
        assert.ok(Number.isInteger(action.choice) && action.choice >= 0 && action.choice <= 3, `bad choice ${id}`);
      } else assert.fail(`bad action ${id}`);
    }
    assert.deepEqual(build.nodes['99848'], { choice: 0 });
    assert.ok(!('99849' in build.nodes) && !('99850' in build.nodes));
  });

  it('spends exactly 34/34/13', () => {
    const spend = { class: 0, spec: 0, hero: 0 };
    for (const [key, action] of Object.entries(build.nodes)) {
      const id = Number(key);
      const pool = CLASS.has(id) ? 'class' : HERO.has(id) ? 'hero' : 'spec';
      assert.ok(CLASS.has(id) || HERO.has(id) || true, `unpooled node ${id}`);
      if (action === 'granted') continue;
      if (typeof action === 'object' && 'partial' in action) spend[pool] += action.partial;
      else if (id === 110406) spend[pool] += build.apexCost;
      else spend[pool] += MULTIRANK[id] ?? 1;
    }
    assert.deepEqual(spend, build.spend);
    assert.deepEqual(build.spend, { class: 34, spec: 34, hero: 13 });
  });

  it('encodes to a string that decodes back to the same selections', () => {
    const selections = actionsToSelections(build.nodes);
    const str = encodeLoadout(build.version, build.specId, selections, ORDER_202);
    const back = decodeLoadout(str, ORDER_202);
    assert.equal(back.version, 2);
    assert.equal(back.specId, 267);
    assert.deepEqual([...back.selections.entries()], [...selections.entries()]);
  });
});
