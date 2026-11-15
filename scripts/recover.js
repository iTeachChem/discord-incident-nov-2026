// iTeachChem server recovery: rebuild deleted channels from the May 2026 data
// package, and undo the mass bans done by the compromised bot.
//
// SETUP
//   1. Use a CLEAN bot you own (new application, or Helper v2 only AFTER its
//      token has been reset). Give it Administrator for the duration.
//   2. Create server-recovery/.env containing one line:
//        BOT_TOKEN=<the new token>
//   3. node recover.js check                    (read-only: shows what would happen)
//
// COMMANDS (nothing changes on the server unless you add --go)
//   node recover.js check
//   node recover.js channels [--go]
//   node recover.js unban --executor <botId> [--since-hours 24] [--go]
//
// Remove Administrator from the bot (or kick it) when done.

const fs = require('fs');
const path = require('path');

const GUILD = '1226379612238385242';
// channels.json + guild.json: next to this script, else in the May 2026 data package
const ARCHIVE = fs.existsSync(path.join(__dirname, 'channels.json'))
  ? __dirname
  : path.resolve(__dirname, '../../Discord chats/Discord Archive May 2026/Servers', GUILD);
const API = 'https://discord.com/api/v10';

// ---------- token ----------
function loadToken() {
  const envFile = path.join(__dirname, '.env');
  if (!fs.existsSync(envFile)) die('Missing server-recovery/.env with BOT_TOKEN=...');
  const m = fs.readFileSync(envFile, 'utf8').match(/^\s*BOT_TOKEN\s*=\s*(.+?)\s*$/m);
  if (!m) die('BOT_TOKEN not found in .env');
  return m[1].replace(/^["']|["']$/g, '');
}
function die(msg) { console.error('ERROR:', msg); process.exit(1); }

let TOKEN;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(method, route, body, reason) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const headers = { Authorization: `Bot ${TOKEN}`, 'User-Agent': 'DiscordBot (recovery-script, 1.0)' };
    if (body) headers['Content-Type'] = 'application/json';
    if (reason) headers['X-Audit-Log-Reason'] = encodeURIComponent(reason);
    const res = await fetch(API + route, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 429) {
      const j = await res.json().catch(() => ({}));
      const wait = Math.ceil(((j.retry_after ?? 2) * 1000)) + 250;
      process.stdout.write(`  (rate limited, waiting ${wait} ms)\n`);
      await sleep(wait);
      continue;
    }
    // be gentle when the bucket is nearly empty
    if (res.headers.get('x-ratelimit-remaining') === '0') {
      await sleep(Number(res.headers.get('x-ratelimit-reset-after') || 1) * 1000 + 100);
    }
    if (res.status === 204) return null;
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) { const e = new Error(`${method} ${route} -> ${res.status} ${text.slice(0, 300)}`); e.status = res.status; e.data = data; throw e; }
    return data;
  }
  throw new Error(`${method} ${route}: gave up after repeated rate limits`);
}

// ---------- helpers ----------
const args = process.argv.slice(2);
const cmd = args[0];
const GO = args.includes('--go');
const argVal = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const snowflakeTime = id => Number(BigInt(id) >> 22n) + 1420070400000;

function loadArchive() {
  const f = path.join(ARCHIVE, 'channels.json');
  if (!fs.existsSync(f)) die('Archive not found at ' + f);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

// Fields Discord accepts on channel create, per type
function buildPayload(ch, parentId, validRoleIds) {
  const p = { name: ch.name, type: ch.type, position: ch.position };
  if (parentId) p.parent_id = parentId;
  p.permission_overwrites = (ch.permission_overwrites || [])
    .filter(o => o.type === 1 || validRoleIds.has(o.id))   // drop overwrites for roles that no longer exist
    .map(o => ({ id: o.id, type: o.type, allow: o.allow, deny: o.deny }));
  const copy = ['topic', 'nsfw', 'rate_limit_per_user', 'bitrate', 'user_limit', 'rtc_region',
    'default_auto_archive_duration', 'default_thread_rate_limit_per_user', 'default_sort_order',
    'default_forum_layout'];
  for (const k of copy) if (ch[k] !== undefined && ch[k] !== null) p[k] = ch[k];
  if (ch.type === 4) { delete p.topic; delete p.nsfw; delete p.rate_limit_per_user; }
  if (ch.type === 2 || ch.type === 13) delete p.topic;
  if (ch.type === 15 || ch.type === 16) {
    if (ch.available_tags) p.available_tags = ch.available_tags.map(t => ({
      name: t.name, moderated: !!t.moderated, emoji_id: t.emoji_id, emoji_name: t.emoji_name,
    }));
    if (ch.default_reaction_emoji) p.default_reaction_emoji = ch.default_reaction_emoji;
  }
  return p;
}

const norm = s => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// ---------- check ----------
async function check() {
  const me = await api('GET', '/users/@me');
  console.log(`Logged in as ${me.username} (${me.id})`);
  const guild = await api('GET', `/guilds/${GUILD}`);
  console.log(`Server: ${guild.name}`);
  const current = await api('GET', `/guilds/${GUILD}/channels`);
  const archived = loadArchive();
  const have = new Set(current.map(c => norm(c.name)));
  const missing = archived.filter(c => !have.has(norm(c.name)));
  console.log(`\nChannels now: ${current.length}  |  in May archive: ${archived.length}  |  would recreate: ${missing.length}`);
  const roleIds = new Set(guild.roles.map(r => r.id));
  const lostRoles = new Set();
  archived.forEach(c => (c.permission_overwrites || []).forEach(o => { if (o.type === 0 && !roleIds.has(o.id)) lostRoles.add(o.id); }));
  if (lostRoles.size) console.log(`Note: ${lostRoles.size} role(s) referenced in old permissions no longer exist; those overwrites will be skipped.`);

  // bans by executor (from audit log)
  const since = Date.now() - Number(argVal('--since-hours', 48)) * 3600e3;
  const entries = await auditBans(since);
  const byExec = {};
  entries.forEach(e => { byExec[e.user_id] = (byExec[e.user_id] || 0) + 1; });
  console.log(`\nBans in audit log, last ${argVal('--since-hours', 48)} h, grouped by who did them:`);
  for (const [id, n] of Object.entries(byExec).sort((a, b) => b[1] - a[1])) console.log(`  executor ${id}: ${n} bans`);
  console.log('\nNext: node recover.js channels   and   node recover.js unban --executor <id of the compromised bot>');
}

async function auditBans(sinceMs) {
  const out = []; let before;
  while (true) {
    const q = `?action_type=22&limit=100${before ? `&before=${before}` : ''}`;
    const r = await api('GET', `/guilds/${GUILD}/audit-logs${q}`);
    const es = r.audit_log_entries || [];
    if (!es.length) break;
    for (const e of es) if (snowflakeTime(e.id) >= sinceMs) out.push(e);
    const oldest = es[es.length - 1];
    if (snowflakeTime(oldest.id) < sinceMs || es.length < 100) break;
    before = oldest.id;
  }
  return out;
}

// ---------- channels ----------
async function channels() {
  const guild = await api('GET', `/guilds/${GUILD}`);
  const roleIds = new Set(guild.roles.map(r => r.id));
  const current = await api('GET', `/guilds/${GUILD}/channels`);
  const have = new Map(current.map(c => [norm(c.name), c]));
  const archived = loadArchive();
  const idMap = {};      // old id -> new id
  const mapFile = path.join(__dirname, 'channel-id-map.json');
  if (fs.existsSync(mapFile)) Object.assign(idMap, JSON.parse(fs.readFileSync(mapFile, 'utf8')));

  const cats = archived.filter(c => c.type === 4).sort((a, b) => a.position - b.position);
  const rest = archived.filter(c => c.type !== 4).sort((a, b) => a.position - b.position);
  let made = 0, skipped = 0, failed = 0;

  for (const ch of [...cats, ...rest]) {
    const existing = have.get(norm(ch.name));
    if (existing) { idMap[ch.id] = idMap[ch.id] || existing.id; skipped++; continue; }
    if (idMap[ch.id]) { skipped++; continue; }          // made on an earlier run
    const parent = ch.parent_id ? idMap[ch.parent_id] : null;
    if (ch.parent_id && !parent && GO) console.log(`  ! parent category for ${ch.name} not found, creating at top level`);
    const payload = buildPayload(ch, parent, roleIds);
    if (!GO) { console.log(`  would create [type ${ch.type}] ${ch.name}${ch.parent_id ? '  (in ' + (archived.find(c => c.id === ch.parent_id)?.name || '?') + ')' : ''}`); made++; continue; }
    try {
      const created = await createWithFallback(payload);
      idMap[ch.id] = created.id;
      fs.writeFileSync(mapFile, JSON.stringify(idMap, null, 2));
      console.log(`  created ${ch.name}`);
      made++;
    } catch (e) { console.log(`  FAILED ${ch.name}: ${e.message}`); failed++; }
  }

  if (GO) {
    // point rules / updates / system channels at the new copies if they were lost
    const g = JSON.parse(fs.readFileSync(path.join(ARCHIVE, 'guild.json'), 'utf8'));
    const patch = {};
    for (const k of ['rules_channel_id', 'public_updates_channel_id', 'system_channel_id']) {
      if (g[k] && idMap[g[k]] && guild[k] !== idMap[g[k]] && !current.find(c => c.id === guild[k])) patch[k] = idMap[g[k]];
    }
    if (Object.keys(patch).length) {
      try { await api('PATCH', `/guilds/${GUILD}`, patch, 'Recovery: re-point server channels'); console.log('  updated server settings:', Object.keys(patch).join(', ')); }
      catch (e) { console.log('  could not update server settings:', e.message); }
    }
  }
  console.log(`\n${GO ? 'Created' : 'Would create'}: ${made}  |  already there: ${skipped}${GO ? '  |  failed: ' + failed : ''}`);
  if (!GO) console.log('Run again with --go to do it.');
}

async function createWithFallback(payload) {
  const reason = 'Recovery: recreate channel deleted in compromise';
  try { return await api('POST', `/guilds/${GUILD}/channels`, payload, reason); }
  catch (e) {
    if (e.status !== 400 && e.status !== 403) throw e;
    // retry without member-specific overwrites, then without extras
    const p2 = { ...payload, permission_overwrites: payload.permission_overwrites.filter(o => o.type === 0) };
    try { return await api('POST', `/guilds/${GUILD}/channels`, p2, reason); }
    catch (e2) {
      const p3 = { name: payload.name, type: payload.type === 13 || payload.type === 5 ? (payload.type === 13 ? 2 : 0) : payload.type,
        parent_id: payload.parent_id, permission_overwrites: p2.permission_overwrites, topic: payload.topic };
      if (p3.type === 2 || p3.type === 4) delete p3.topic;
      console.log(`    (created ${payload.name} with basic settings only: ${e2.message.slice(0, 120)})`);
      return await api('POST', `/guilds/${GUILD}/channels`, p3, reason);
    }
  }
}

// ---------- unban ----------
async function unban() {
  const executor = argVal('--executor');
  if (!executor) die('Pass --executor <id of the compromised bot>. Run "check" first to see who did the bans.');
  const since = Date.now() - Number(argVal('--since-hours', 24)) * 3600e3;
  const entries = (await auditBans(since)).filter(e => e.user_id === executor);
  const targets = [...new Set(entries.map(e => e.target_id))];
  const keep = new Set((argVal('--keep', '') || '').split(',').filter(Boolean)); // ids to leave banned
  const todo = targets.filter(t => !keep.has(t));
  console.log(`${todo.length} members banned by ${executor} in the window${keep.size ? ` (${keep.size} kept banned)` : ''}.`);
  if (!GO) { console.log('Run again with --go to unban them.'); return; }
  const doneFile = path.join(__dirname, 'unbanned.txt');
  const done = new Set(fs.existsSync(doneFile) ? fs.readFileSync(doneFile, 'utf8').split('\n').filter(Boolean) : []);
  let n = 0, fail = 0;
  for (const id of todo) {
    if (done.has(id)) continue;
    try { await api('DELETE', `/guilds/${GUILD}/bans/${id}`, null, 'Recovery: undo mass ban by compromised bot'); }
    catch (e) { if (e.status !== 404) { fail++; console.log(`  failed ${id}: ${e.message}`); continue; } }
    fs.appendFileSync(doneFile, id + '\n');
    if (++n % 25 === 0) console.log(`  ${n}/${todo.length} unbanned`);
  }
  console.log(`Done. Unbanned ${n}, failed ${fail}. (List saved to unbanned.txt)`);
}

// ---------- main ----------
(async () => {
  if (!['check', 'channels', 'unban'].includes(cmd)) {
    console.log('Usage: node recover.js check | channels [--go] | unban --executor <botId> [--since-hours 24] [--keep id1,id2] [--go]');
    process.exit(1);
  }
  TOKEN = loadToken();
  if (cmd === 'check') await check();
  if (cmd === 'channels') await channels();
  if (cmd === 'unban') await unban();
})().catch(e => die(e.message));
