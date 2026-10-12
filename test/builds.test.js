import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const sba = JSON.parse(readFileSync(new URL('../data/sba.json', import.meta.url), 'utf8'));
const specIds = new Set(sba.map((s) => s.specId));

describe('builds convention', () => {
  it('maps every build file to a known spec with content', () => {
    const files = readdirSync(new URL('../builds/', import.meta.url)).filter((f) => f.endsWith('.md'));
    assert.ok(files.length > 0, 'expected at least one build guide');
    for (const f of files) {
      const id = Number(f.replace(/\.md$/, ''));
      assert.ok(Number.isInteger(id), `${f} is not named <specId>.md`);
      assert.ok(specIds.has(id), `${f} matches no spec in data/sba.json`);
      const body = readFileSync(new URL(`../builds/${f}`, import.meta.url), 'utf8').trim();
      assert.ok(body.length > 100, `${f} looks empty`);
    }
  });
});
