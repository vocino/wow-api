import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tokenUrl, apiUrl, namespace, basicAuthHeader, readCredentials, parseDotEnv, loadDotEnv, talentSpells, pvpTalentSpells, localName, dataVersion } from '../src/bnet.js';

describe('bnet helpers', () => {
  it('builds the region-agnostic token URL', () => {
    assert.equal(tokenUrl(), 'https://oauth.battle.net/token');
  });

  it('builds regional API URLs', () => {
    assert.equal(apiUrl('us', '/data/wow/spell/116858'), 'https://us.api.blizzard.com/data/wow/spell/116858');
  });

  it('builds namespace strings', () => {
    assert.equal(namespace('static', 'us'), 'static-us');
  });

  it('builds a Basic auth header', () => {
    assert.equal(basicAuthHeader('id', 'secret'), 'Basic ' + Buffer.from('id:secret').toString('base64'));
  });

  it('reads credentials from the environment', () => {
    assert.deepEqual(
      readCredentials({ BNET_ID: 'a', BNET_SECRET: 'b' }),
      { clientId: 'a', clientSecret: 'b' }
    );
  });

  it('throws when credentials are missing', () => {
    assert.throws(() => readCredentials({}), /missing credentials/);
  });

  it('parses dotenv content', () => {
    assert.deepEqual(
      parseDotEnv('BNET_ID=abc\n# comment\n\nBNET_SECRET="x=y"\nEMPTY=\nnoequals\n'),
      { BNET_ID: 'abc', BNET_SECRET: 'x=y', EMPTY: '' }
    );
  });

  it('returns false when the dotenv file is missing', () => {
    assert.equal(loadDotEnv('Z:\\does\\not\\exist.env', {}), false);
  });

  it('extracts talent names and spell ids from tree nodes', () => {
    const nodes = [
      { node_type: { type: 'ACTIVE' }, ranks: [{ tooltip: { talent: { name: { en_US: 'Chaos Bolt' } }, spell_tooltip: { spell: { id: 116858 } } } }] },
      { node_type: { type: 'PASSIVE' }, ranks: [{ tooltip: { talent: { name: 'Backdraft' } } }, { tooltip: { talent: { name: 'Backdraft' } } }] },
      { node_type: { type: 'ACTIVE' }, ranks: [] }
    ];
    assert.deepEqual(talentSpells(nodes), [
      { name: 'Chaos Bolt', spellId: 116858, type: 'ACTIVE' },
      { name: 'Backdraft', spellId: null, type: 'PASSIVE' }
    ]);
  });

  it('returns an empty list for missing nodes', () => {
    assert.deepEqual(talentSpells(undefined), []);
  });

  it('resolves plain, localized, and missing names', () => {
    assert.equal(localName('Chaos Bolt'), 'Chaos Bolt');
    assert.equal(localName({ en_US: 'Diabolist', de_DE: 'Diabolist' }), 'Diabolist');
    assert.equal(localName(undefined), null);
    assert.equal(localName({}), null);
  });

  it('extracts PvP talents with descriptions', () => {
    const entries = [
      { talent: { name: 'Nether Ward', id: 3508 }, spell_tooltip: { description: 'Reflects spells.' } },
      { talent: { name: { en_US: 'Bane of Havoc' }, id: 164 }, spell_tooltip: {} },
      { talent: {}, spell_tooltip: {} }
    ];
    assert.deepEqual(pvpTalentSpells(entries), [
      { name: 'Nether Ward', talentId: 3508, description: 'Reflects spells.' },
      { name: 'Bane of Havoc', talentId: 164, description: null }
    ]);
  });

  it('returns an empty list for missing PvP entries', () => {
    assert.deepEqual(pvpTalentSpells(undefined), []);
  });

  it('extracts the game data version from response links', () => {
    assert.deepEqual(
      dataVersion({ _links: { self: { href: 'https://us.api.blizzard.com/data/wow/spell/116858?namespace=static-12.1.0_68914-us' } } }),
      { namespace: 'static-12.1.0_68914-us', type: 'static', patch: '12.1.0', build: '68914', region: 'us' }
    );
  });

  it('returns null when no versioned namespace is present', () => {
    assert.equal(dataVersion({}), null);
    assert.equal(dataVersion({ _links: { self: { href: 'https://us.api.blizzard.com/data/wow/spell/116858?namespace=static-us' } } }), null);
    assert.equal(dataVersion(undefined), null);
  });
});
