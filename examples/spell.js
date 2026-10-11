// Usage: node examples/spell.js <spell-id>  (e.g. 116858 = Chaos Bolt)
// Requires BNET_ID and BNET_SECRET in .env or the environment.
import { getAccessToken, gameData, namespace, readCredentials, loadDotEnv, DEFAULT_REGION } from '../src/bnet.js';

async function main() {
  const spellId = process.argv[2];
  if (!spellId) {
    console.error('usage: node examples/spell.js <spell-id>');
    process.exit(2);
  }

  loadDotEnv();
  const region = process.env.BNET_REGION || DEFAULT_REGION;
  const { clientId, clientSecret } = readCredentials();
  const token = await getAccessToken({ clientId, clientSecret });
  const spell = await gameData({
    path: `/data/wow/spell/${spellId}`,
    token,
    namespace: namespace('static', region),
    region
  });
  console.log(JSON.stringify({ id: spell.id, name: spell.name, description: spell.description }, null, 2));
}

main().catch((err) => {
  console.error(`error: ${err.message}`);
  process.exit(1);
});
