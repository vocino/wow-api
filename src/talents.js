// Blizzard talent loadout import/export strings.
// Format: Blizzard_ClassTalentImportExport.lua + ExportUtil.lua (Gethe/wow-ui-source).
// Node order: ascending node ID over the class tree = class nodes + every spec's
// nodes, plus the game-side subtree selectors 99849/99850 (siblings of 99848,
// one selector per spec) when the API omits them. Discovered in client
// TraitNode data (warlock tree 720) and validated by decoding real-world
// strings (see test/talent-string.test.js).

import { gameData, getHref, namespace } from './bnet.js';

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export const HEADER_BITS = 8 + 16 + 128; // version + specId + tree hash
export const LOADOUT_VERSION = 2;

// Game-side subtree selectors, occasionally missing from the web API. They sort
// here in the ascending order (verified: every real string parses cleanly with
// them). Inserted only when absent so API updates can't duplicate them.
const UNLISTED_AFTER_ID = 99848;
const UNLISTED_IDS = [99849, 99850];

export function stringToBits(str) {
  const bits = [];
  for (const ch of str.trim()) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) throw new Error(`invalid loadout character: ${ch}`);
    for (let i = 0; i < 6; i++) bits.push((v >> i) & 1);
  }
  return bits;
}

export function bitsToString(bits) {
  let out = '';
  for (let i = 0; i < bits.length; i += 6) {
    let v = 0;
    for (let k = 0; k < 6 && i + k < bits.length; k++) v |= (bits[i + k] & 1) << k;
    out += ALPHABET[v];
  }
  return out;
}

function readInt(bits, pos, width) {
  let v = 0;
  for (let k = 0; k < width; k++) v |= (bits[pos + k] ?? 0) << k;
  return v;
}

// nodeArrays: list of talent-node arrays (class + each spec's). Returns ascending
// ID order with the unlisted game-side nodes inserted at their sorted position.
export function buildOrder(nodeArrays) {
  const ids = new Set();
  for (const arr of nodeArrays) for (const n of arr ?? []) ids.add(n.id);
  const order = [...ids].sort((a, b) => a - b);
  const missing = UNLISTED_IDS.filter((id) => !ids.has(id));
  if (missing.length) {
    const at = order.indexOf(UNLISTED_AFTER_ID);
    if (at >= 0) order.splice(at + 1, 0, ...missing);
    else {
      const before = order.findIndex((id) => id > UNLISTED_AFTER_ID);
      order.splice(before < 0 ? order.length : before, 0, ...missing);
    }
  }
  return order;
}

// selections: Map<id, {purchased, rank|null, choice|null}>
export function decodeLoadout(str, order) {
  const bits = stringToBits(str);
  if (bits.length < HEADER_BITS) throw new Error('loadout string shorter than header');
  const version = readInt(bits, 0, 8);
  const specId = readInt(bits, 8, 16);
  let p = HEADER_BITS;
  const selections = new Map();
  for (const id of order) {
    if ((bits[p++] ?? 0) === 0) continue;
    const purchased = (bits[p++] ?? 0) === 1;
    let rank = null;
    let choice = null;
    if (purchased) {
      if ((bits[p++] ?? 0) === 1) {
        rank = readInt(bits, p, 6);
        p += 6;
      }
      if ((bits[p++] ?? 0) === 1) {
        choice = (bits[p++] ?? 0) | ((bits[p++] ?? 0) << 1);
      }
    }
    selections.set(id, { purchased, rank, choice });
  }
  return { version, specId, selections, endBit: p, totalBits: bits.length };
}

// Third-party strings use a zero-filled tree hash (no extra validation on import).
export function encodeLoadout(version, specId, selections, order) {
  const bits = [];
  for (let k = 0; k < 8; k++) bits.push((version >> k) & 1);
  for (let k = 0; k < 16; k++) bits.push((specId >> k) & 1);
  for (let k = 0; k < 128; k++) bits.push(0);
  for (const id of order) {
    const v = selections.get(id);
    if (!v) {
      bits.push(0);
      continue;
    }
    bits.push(1, v.purchased ? 1 : 0);
    if (v.purchased) {
      if (v.rank === null || v.rank === undefined) bits.push(0);
      else {
        bits.push(1);
        for (let k = 0; k < 6; k++) bits.push((v.rank >> k) & 1);
      }
      if (v.choice === null || v.choice === undefined) bits.push(0);
      else bits.push(1, v.choice & 1, (v.choice >> 1) & 1);
    }
  }
  return bitsToString(bits);
}

// Build-file actions ('full' | 'granted' | {partial} | {choice}) to selections.
export function actionsToSelections(nodes) {
  const selections = new Map();
  for (const [key, action] of Object.entries(nodes ?? {})) {
    const id = Number(key);
    if (action === 'full') selections.set(id, { purchased: true, rank: null, choice: null });
    else if (action === 'granted') selections.set(id, { purchased: false, rank: null, choice: null });
    else if (typeof action === 'object' && action !== null && 'partial' in action) {
      selections.set(id, { purchased: true, rank: action.partial, choice: null });
    } else if (typeof action === 'object' && action !== null && 'choice' in action) {
      selections.set(id, { purchased: true, rank: null, choice: action.choice });
    } else throw new Error(`invalid action for node ${key}`);
  }
  return selections;
}

async function fetchTree(token, specId) {
  const spec = await gameData({
    path: `/data/wow/playable-specialization/${specId}`,
    token,
    namespace: namespace('static', 'us'),
    region: 'us',
  });
  return getHref(spec.spec_talent_tree.key.href, token);
}

// Live class-tree order + node pool for the given specs of one class.
export async function fetchClassOrder(token, specIds) {
  const trees = [];
  for (const id of specIds) trees.push(await fetchTree(token, id));
  const pool = new Map();
  const arrays = [];
  for (const t of trees) {
    arrays.push(t.class_talent_nodes ?? [], t.spec_talent_nodes ?? []);
    for (const n of [...(t.class_talent_nodes ?? []), ...(t.spec_talent_nodes ?? [])]) {
      if (!pool.has(n.id)) pool.set(n.id, n);
    }
  }
  return { order: buildOrder(arrays), pool, trees };
}
