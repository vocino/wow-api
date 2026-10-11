// Usage: node examples/spec-toolkit.js <specialization-id>  (e.g. 267 = Destruction Warlock)
// Lists the spec's class-tree, spec-tree, hero-tree, and PvP talents.
// Requires BNET_ID and BNET_SECRET in .env or the environment.
import { getAccessToken, gameData, getHref, namespace, readCredentials, loadDotEnv, talentSpells, pvpTalentSpells, localName, DEFAULT_REGION } from '../src/bnet.js';

async function main() {
  const specId = process.argv[2];
  if (!specId) {
    console.error('usage: node examples/spec-toolkit.js <specialization-id>');
    process.exit(2);
  }

  loadDotEnv();
  const region = process.env.BNET_REGION || DEFAULT_REGION;
  const ns = namespace('static', region);
  const { clientId, clientSecret } = readCredentials();
  const token = await getAccessToken({ clientId, clientSecret });

  const spec = await gameData({ path: `/data/wow/playable-specialization/${specId}`, token, namespace: ns, region });
  const tree = await getHref(spec.spec_talent_tree.key.href, token);

  const heroIds = new Set((spec.hero_talent_trees ?? []).map((t) => t.id));
  const heroTalents = (tree.hero_talent_trees ?? [])
    .filter((t) => heroIds.has(t.id))
    .map((t) => ({ tree: localName(t.name), talents: talentSpells(t.hero_talent_nodes) }));

  console.log(JSON.stringify({
    spec: spec.name,
    class: spec.playable_class.name,
    classTalents: talentSpells(tree.class_talent_nodes),
    specTalents: talentSpells(tree.spec_talent_nodes),
    heroTalents,
    pvpTalents: pvpTalentSpells(spec.pvp_talents)
  }, null, 1));
}

main().catch((err) => {
  console.error(`error: ${err.message}`);
  process.exit(1);
});
