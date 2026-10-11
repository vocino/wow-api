// Minimal Battle.net Game Data client. No dependencies; uses global fetch (Node 18+).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULT_REGION = 'us';
export const DEFAULT_LOCALE = 'en_US';

export function tokenUrl() {
  return 'https://oauth.battle.net/token';
}

export function apiUrl(region, path) {
  return `https://${region}.api.blizzard.com${path}`;
}

export function namespace(type, region) {
  return `${type}-${region}`;
}

export function basicAuthHeader(clientId, clientSecret) {
  return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');
}

export function readCredentials(env = process.env) {
  const clientId = env.BNET_ID;
  const clientSecret = env.BNET_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('missing credentials: set BNET_ID and BNET_SECRET');
  }
  return { clientId, clientSecret };
}

export function parseDotEnv(text) {
  const vars = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.length >= 2 && value.startsWith(value[0]) && (value[0] === '"' || value[0] === "'") && value.endsWith(value[0])) {
      value = value.slice(1, -1);
    }
    if (key) vars[key] = value;
  }
  return vars;
}

export function loadDotEnv(path = join(process.cwd(), '.env'), env = process.env) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return false;
  }
  for (const [key, value] of Object.entries(parseDotEnv(text))) {
    if (!(key in env)) env[key] = value;
  }
  return true;
}

export async function getAccessToken({ clientId, clientSecret }) {
  const res = await fetch(tokenUrl(), {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  if (!res.ok) {
    throw new Error(`token request failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return data.access_token;
}

export async function getHref(href, token) {
  const res = await fetch(href, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`api request failed: ${res.status} ${res.statusText} (${href})`);
  }
  return res.json();
}

export function localName(value) {
  if (typeof value === 'string') return value;
  return value?.en_US ?? null;
}

export function dataVersion(doc) {
  const href = doc?._links?.self?.href ?? '';
  const match = href.match(/[?&]namespace=((static|dynamic|profile)-([\d.]+)_(\d+)-([a-z]+))(?:&|$)/);
  if (!match) return null;
  return { namespace: match[1], type: match[2], patch: match[3], build: match[4], region: match[5] };
}

export function talentSpells(nodes) {
  const out = [];
  const seen = new Set();
  for (const node of nodes ?? []) {
    for (const rank of node.ranks ?? []) {
      const talent = rank.tooltip?.talent;
      const spell = rank.tooltip?.spell_tooltip?.spell;
      const name = localName(talent?.name);
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.push({ name, spellId: spell?.id ?? null, type: node.node_type?.type ?? null });
    }
  }
  return out;
}

export function pvpTalentSpells(entries) {
  const out = [];
  for (const entry of entries ?? []) {
    const name = localName(entry.talent?.name);
    if (!name) continue;
    out.push({ name, talentId: entry.talent?.id ?? null, description: entry.spell_tooltip?.description ?? null });
  }
  return out;
}

export async function gameData({ path, token, namespace: ns, locale = DEFAULT_LOCALE, region = DEFAULT_REGION }) {
  const url = new URL(apiUrl(region, path));
  url.searchParams.set('namespace', ns);
  url.searchParams.set('locale', locale);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`api request failed: ${res.status} ${res.statusText} (${path})`);
  }
  return res.json();
}
