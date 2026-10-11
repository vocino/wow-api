// Usage (from repo root): node scripts/build-wiki.js
// Rebuilds wiki/ class/spec pages from LIVE game data. Output carries a
// version/date footer so staleness is visible. Overwrites generated pages,
// so review with `git -C wiki diff` before pushing the wiki.
// Requires BNET_ID and BNET_SECRET in .env or the environment.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAccessToken, gameData, namespace, readCredentials, loadDotEnv, dataVersion, DEFAULT_REGION } from '../src/bnet.js';

const ROOT = process.cwd();
const OUT = join(ROOT, 'wiki');

async function main() {
  loadDotEnv(join(ROOT, '.env'));
  const region = process.env.BNET_REGION || DEFAULT_REGION;
  const ns = namespace('static', region);
  const { clientId, clientSecret } = readCredentials();
  const token = await getAccessToken({ clientId, clientSecret });
  const get = (path) => gameData({ path, token, namespace: ns, region });

  const index = await get('/data/wow/playable-class/index');
  const version = dataVersion(index);
  const stamp = version?.namespace ?? ns;
  const today = new Date().toISOString().slice(0, 10);
  const footer = `\n---\n*Game data: \`${stamp}\`, retrieved ${today}.*\n`;
  console.log(`version=${stamp} date=${today}`);

  const classes = [];
  for (const ref of index.classes ?? []) {
    const klass = await get(`/data/wow/playable-class/${ref.id}`);
    classes.push({
      id: klass.id,
      name: klass.name,
      specializations: (klass.specializations ?? []).map((s) => ({ id: s.id, name: s.name }))
    });
  }
  classes.sort((a, b) => a.name.localeCompare(b.name));
  for (const c of classes) c.specializations.sort((a, b) => a.name.localeCompare(b.name));

  const file = (name) => name.replace(/ /g, '-');

  const EXTRA = {
    267: `\n## Single-Button Assistant\n\nSBA cycles the single-target rotation (Icy Veins Easy Mode, Midnight Season 1):\n\n- Summon Infernal (\`1122\`)\n- Immolate (\`348\`)\n- Chaos Bolt (\`116858\`)\n- Conflagrate (\`17962\`)\n- Cataclysm (\`152108\`)\n- Incinerate (\`29722\`)\n\nHero talent trees: Diabolist, Hellcaller.\n`
  };

  let sidebar = '';
  for (const c of classes) {
    sidebar += `- [[${c.name}]]\n`;
    for (const s of c.specializations) sidebar += `  - [[${c.name} ${s.name}]]\n`;
  }
  writeFileSync(join(OUT, '_Sidebar.md'), sidebar);

  let home = 'Class guides and specialization notes, backed by Battle.net API queries.\n\n## Classes\n\n';
  for (const c of classes) home += `- [[${c.name}]]\n`;
  writeFileSync(join(OUT, 'Home.md'), home + footer);

  for (const c of classes) {
    let page = `Battle.net class ID: \`${c.id}\`\n\n## Specializations\n\n`;
    for (const s of c.specializations) page += `- [[${c.name} ${s.name}]]\n`;
    page += '\n## Queries\n\n```powershell\nnode examples/spec-toolkit.js <spec-id>\n```\n';
    writeFileSync(join(OUT, `${file(c.name)}.md`), page + footer);

    for (const s of c.specializations) {
      let spec = `Parent: [[${c.name}]]\n\nBattle.net spec ID: \`${s.id}\`\n\n## Queries\n\n`
        + `\`\`\`powershell\nnode examples/spec-toolkit.js ${s.id}\n\`\`\`\n`;
      if (EXTRA[s.id]) spec += EXTRA[s.id];
      writeFileSync(join(OUT, `${file(c.name)}-${file(s.name)}.md`), spec + footer);
    }
  }
  console.log(`classes=${classes.length}`);
}

main().catch((err) => {
  console.error(`error: ${err.message}`);
  process.exit(1);
});
