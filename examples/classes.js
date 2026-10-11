// Usage: node examples/classes.js
// Lists playable classes and specializations with their ids.
// Requires BNET_ID and BNET_SECRET in .env or the environment.
import { getAccessToken, gameData, namespace, readCredentials, loadDotEnv, DEFAULT_REGION } from '../src/bnet.js';

async function main() {
  loadDotEnv();
  const region = process.env.BNET_REGION || DEFAULT_REGION;
  const ns = namespace('static', region);
  const { clientId, clientSecret } = readCredentials();
  const token = await getAccessToken({ clientId, clientSecret });

  const index = await gameData({ path: '/data/wow/playable-class/index', token, namespace: ns, region });
  const classes = [];
  for (const ref of index.classes ?? []) {
    const klass = await gameData({ path: `/data/wow/playable-class/${ref.id}`, token, namespace: ns, region });
    classes.push({
      id: klass.id,
      name: klass.name,
      specializations: (klass.specializations ?? []).map((s) => ({ id: s.id, name: s.name }))
    });
  }
  console.log(JSON.stringify(classes, null, 1));
}

main().catch((err) => {
  console.error(`error: ${err.message}`);
  process.exit(1);
});
