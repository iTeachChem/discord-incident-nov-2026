# Recovery scripts

Node 18+, no dependencies. They need a bot token in a `.env` file next to the script (`BOT_TOKEN=...`). Use a fresh bot made just for the recovery, give it Administrator for the run only, and delete it afterwards.

| Script | What it does |
|---|---|
| `recover.js check` | Read-only. Lists the channels that are missing compared with your backup, and who did the bans in the audit log. |
| `recover.js channels [--go]` | Rebuilds channels from `channels.json` and `guild.json` (from your Discord data download: `Servers/<server id>/`): categories, order, topics, forum tags, slow mode and permissions. It previews unless you add `--go`. |
| `recover.js unban --executor <id> [--go]` | Reverses every ban that one account made in the audit log window (default: the last 24 h). It saves its progress, so you can re-run it safely. |
| `unban-user.js <username> ...` | Unbans specific people straight away. |

Change `GUILD` at the top of `recover.js` to your server's ID.
