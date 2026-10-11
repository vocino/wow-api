import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('../data/sba.json', import.meta.url), 'utf8'));

describe('sba data', () => {
  it('covers 40 specs with unique ids', () => {
    assert.equal(data.length, 40);
    assert.equal(new Set(data.map((s) => s.specId)).size, 40);
  });

  it('lists a sourced ability list per spec', () => {
    for (const spec of data) {
      assert.ok(spec.abilities.length > 0, `spec ${spec.specId} has no abilities`);
      assert.match(spec.source, /^https:\/\//, `spec ${spec.specId} has no source`);
      assert.ok(spec.patch.length > 0, `spec ${spec.specId} has no patch label`);
      for (const a of spec.abilities) {
        assert.equal(typeof a.name, 'string');
        assert.ok(a.name.length > 0, `spec ${spec.specId} has an unnamed ability`);
      }
    }
  });

  it('resolves spell or item ids except documented gaps', () => {
    const gaps = [];
    for (const spec of data)
      for (const a of spec.abilities)
        if (a.spellId == null && a.itemId == null) gaps.push(`${spec.specId}/${a.name}`);
    assert.deepEqual(gaps, ['71/Heroic Strike']);
  });
});
