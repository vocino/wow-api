// CLI for talent loadout strings: encode a builds/<specId>.json file, decode a
// string back to selections, or live-check a build file (spends + pathing).
// Usage: node scripts/talent-string.js encode 267 | decode <string> | check 267
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  actionsToSelections,
  decodeLoadout,
  encodeLoadout,
  fetchClassOrder,
  LOADOUT_VERSION,
} from '../src/talents.js';
import { getAccessToken, loadDotEnv, localName, readCredentials } from '../src/bnet.js';

const WARLOCK_SPECS = [267, 265, 266];

function nodeName(n) {
  return (
    localName(n?.ranks?.[0]?.tooltip?.talent?.name) ??
    localName(n?.ranks?.[0]?.choice_of_tooltips?.[0]?.talent?.name) ??
    '?'
  );
}

async function liveOrder() {
  loadDotEnv(join(process.cwd(), '.env'));
  const { clientId, clientSecret } = readCredentials();
  const token = await getAccessToken({ clientId, clientSecret });
  return fetchClassOrder(token, WARLOCK_SPECS);
}

function readBuild(specId) {
  return JSON.parse(readFileSync(new URL(`../builds/${specId}.json`, import.meta.url), 'utf8'));
}

async function encode(specId) {
  const build = readBuild(specId);
  const { order } = await liveOrder();
  console.log(encodeLoadout(build.version ?? LOADOUT_VERSION, build.specId, actionsToSelections(build.nodes), order));
}

async function decode(str) {
  const { order, pool } = await liveOrder();
  const d = decodeLoadout(str, order);
  console.log(`version=${d.version} spec=${d.specId} end=${d.endBit}/${d.totalBits}`);
  for (const [id, v] of d.selections) {
    const n = pool.get(id);
    console.log(`${id} purch=${v.purchased} rank=${v.rank ?? 'MAX'} choice=${v.choice} :: ${n ? nodeName(n) : '(unlisted)'}`);
  }
}

async function check(specId) {
  const build = readBuild(specId);
  const { order, pool, trees } = await liveOrder();
  const orderSet = new Set(order);
  const cls = new Set((trees[0].class_talent_nodes ?? []).map((n) => n.id));
  const des = new Set((trees[0].spec_talent_nodes ?? []).map((n) => n.id));
  const aff = new Set((trees[1].spec_talent_nodes ?? []).map((n) => n.id));
  const dem = new Set((trees[2].spec_talent_nodes ?? []).map((n) => n.id));
  const isDiabolist = (id) => dem.has(id) && des.has(id) && !aff.has(id);
  const selections = actionsToSelections(build.nodes);
  let fail = 0;
  const picks = new Set([...selections.keys()]);
  const spend = { class: 0, spec: 0, hero: 0 };
  for (const [id, v] of selections) {
    if (!orderSet.has(id)) {
      console.log(`unknown node ${id}`);
      fail++;
      continue;
    }
    if (!v.purchased) continue;
    const n = pool.get(id);
    const maxR = id === 110406 ? (build.apexCost ?? 4) : (n?.ranks?.length || 1);
    const pts = v.rank ?? maxR;
    if (v.rank !== null && (v.rank < 1 || v.rank >= maxR)) {
      console.log(`bad partial ${id}: rank ${v.rank} vs max ${maxR}`);
      fail++;
    }
    if (v.choice !== null && (v.choice < 0 || v.choice > 3)) {
      console.log(`bad choice index ${id}: ${v.choice}`);
      fail++;
    }
    if (cls.has(id)) spend.class += pts;
    else if (isDiabolist(id)) spend.hero += pts;
    else if (des.has(id)) spend.spec += pts;
    else {
      console.log(`off-build node ${id} (${nodeName(n)})`);
      fail++;
    }
  }
  for (const id of picks) {
    const locks = pool.get(id)?.locked_by ?? [];
    if (locks.length && !locks.some((l) => picks.has(l))) {
      console.log(`pathing: ${id} (${nodeName(pool.get(id))}) locked by [${locks}]`);
      fail++;
    }
  }
  for (const [poolName, want] of Object.entries(build.spend ?? {})) {
    if (spend[poolName] !== want) {
      console.log(`spend ${poolName}: ${spend[poolName]} != ${want}`);
      fail++;
    }
  }
  console.log(`spend=${JSON.stringify(spend)} ${fail ? `FAIL(${fail})` : 'OK'}`);
  if (fail) process.exitCode = 1;
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'encode' && arg) await encode(Number(arg));
else if (cmd === 'decode' && arg) await decode(arg);
else if (cmd === 'check' && arg) await check(Number(arg));
else {
  console.error('usage: node scripts/talent-string.js encode|decode|check <specId|string>');
  process.exitCode = 2;
}
