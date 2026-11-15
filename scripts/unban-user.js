// node unban-user.js <username> [username2 ...]   - unban specific people right away
const fs = require('fs'), path = require('path');
const T = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(/BOT_TOKEN=(.+)/)[1].trim();
const G = '1226379612238385242', H = { Authorization: 'Bot ' + T };
(async () => {
  const names = process.argv.slice(2).map(s => s.toLowerCase());
  let all = [], after = '0';
  while (true) {
    const b = await (await fetch(`https://discord.com/api/v10/guilds/${G}/bans?limit=1000&after=${after}`, { headers: H })).json();
    all.push(...b); if (b.length < 1000) break; after = b[b.length - 1].user.id;
  }
  for (const n of names) {
    const hit = all.find(b => b.user.username.toLowerCase() === n);
    if (!hit) { console.log(`${n}: not banned (already unbanned?)`); continue; }
    if (hit.user.id === '698549964820971547') { console.log(`${n}: attacker, skipped`); continue; }
    const r = await fetch(`https://discord.com/api/v10/guilds/${G}/bans/${hit.user.id}`, { method: 'DELETE', headers: { ...H, 'X-Audit-Log-Reason': 'Recovery: undo mass ban' } });
    console.log(`${n}: ${r.status === 204 ? 'unbanned' : 'failed ' + r.status}`);
  }
})();
