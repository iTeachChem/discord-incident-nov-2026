# iTeachChem Discord: the 15 November 2026 attack, and how we recovered

**iTeachChem** is a free Discord server for Indian students preparing for JEE, NEET and board exams. It's a student-moderated safe space to ask doubts in chemistry, physics, maths and biology without being judged. Twice a week we also hold short **Bhagavad Gita As It Is** reading sessions for anyone who wants them.

On the night of **15 November 2026**, someone took over one of our bots and wrecked the server. This page explains what happened, what we've fixed, what we lost, and how you can help.

**Rejoin the server:** https://discord.gg/bNpAqNhAZ

---

## What happened

All times are IST (UTC+5:30), taken from the server's audit log.

| Time | What happened |
|---|---|
| Shortly before | The attacker's account joins the server. |
| 10:14 PM | Our helper bot (`iteachchemhelperv2`), running on a **stolen bot token**, creates a role called "Admin" with full Administrator permission and gives it to the attacker. The audit log reason reads *"Admin role created just below the bot via uwu2 script"*, so this was an automated server-wrecking tool, not someone clicking around by hand. |
| 10:14 – 10:35 PM | The bot and the attacker delete **every channel** on the server. |
| same window | The attacker bans **1,076 members** from his own account, using the Admin role. |
| Same night | The mods ban the attacker and remove the bot, then start the recovery. |

**Nobody's Discord account was hacked.** The weak point was a bot token, the password a bot uses to log in. Whoever had that token could make the bot do anything its permissions allowed, and it had Administrator.

We still don't know how the token leaked. We checked the full history of every public repository in our GitHub organisations and found no Discord tokens in any of them. The investigation is ongoing.

## The attacker

| | |
|---|---|
| Username | `trtrtrtrturkiye` |
| Display name | Flag |
| Discord user ID | `698549964820971547` |
| Account created | April 2020 |

He's banned from iTeachChem and has been reported to Discord Trust & Safety. **If you run a Discord server, please ban this ID in advance.** If he DMs you, don't click any links or download anything. Block and report him.

## What we've fixed

Done within a few hours of the attack:

- **All 1,076 members unbanned.** The audit log recorded every ban, so a script read the attacker's ban entries and reversed exactly those. Older bans for real rule-breaking stayed in place.
- **All 65 channels rebuilt as they were.** The server owner's Discord data download from May 2026 included a snapshot of the server's layout. From it we restored the categories, channel names, topics, forum tags, slow-mode settings and permissions.
- **Onboarding fixed.** The questions new members answer when they join (class, college, which subjects they help with) were updated to point at the rebuilt channels, so returning students can pick their roles again.
- **Locked down:**
  - the compromised bot is removed
  - the attacker's "Admin" role is deleted
  - **Wick anti-nuke** is installed, which automatically quarantines anyone who mass-deletes channels or mass-bans members
  - moderators need two-factor authentication for moderator actions
- **Doubts website** ([iteachchem.github.io/iteachchem-doubts](https://iteachchem.github.io/iteachchem-doubts/)): all 4,416 doubt titles and subject tags are still up, with a work-in-progress notice. The links to the old threads are switched off for now, because they lead to deleted pages.

The scripts we used are in [`scripts/`](scripts/). Other server admins are welcome to reuse them; see [What other server admins can learn](#what-other-server-admins-can-learn).

## What we lost

- **Every message in every channel.** That's years of doubts, answers and discussion between students and teachers.
- **Answer Overflow's public copies** of our doubt threads. Answer Overflow removed them automatically when the channels were deleted.
- **Members' roles.** Discord removes a banned member's roles, so everyone has to pick them again.
- A few channels created after May 2026, which weren't in the snapshot.

**The Bhagavad Gita sessions are not lost.** Every session is on:
- **YouTube:** https://www.youtube.com/playlist?list=PL5l36jh8Oss7EPz9YQi4N0qpBbEaYTeZn
- **Spotify:** https://open.spotify.com/show/4RrPnP7V934IpVZTyDucU1

**Doubts:** we're working out how to rebuild them. So far we know that:
- the server owner's own replies (in about 2,500 threads) are in his May 2026 data download
- some threads were saved by the Wayback Machine
- every member's personal Discord data download contains the messages *they* sent

## Why this matters right now

**JEE Main is in January.** These are the most important weeks of the year for our students, and the doubt-solving community is where many of them get help they can't get anywhere else. Every week the server isn't fully back, students lose part of that help.

## How you can help

**Discord:** we've filed a Trust & Safety report. If anyone at Discord reads this, we'd be very grateful for help **restoring the deleted channel messages** for server `1226379612238385242`. It is a non-commercial student community, and the deletions were done with a stolen bot token on 15 November 2026 between 10:14 and 10:35 PM IST.

**Members:** please request your own Discord data download (User Settings → Data & Privacy → Request Data). When it arrives, share the `Messages` folders for iTeachChem channels with a mod. Put enough of these together and we can rebuild a lot of the old doubt threads.

**Everyone else:** share this page, and share the invite with any student who was removed: https://discord.gg/bNpAqNhAZ

## What other server admins can learn

1. **Never give a bot Administrator.** Give each bot only the permissions it actually uses. A doubts bot doesn't need to ban members or delete channels.
2. **Place bot roles low in the role list.** A bot can only hand out roles below its own.
3. **Treat bot tokens like passwords.** Keep them out of code and out of shared chats, reset them whenever anyone with access leaves, and limit who is on the bot's Developer Portal team.
4. **Use an anti-nuke bot** such as Wick, with its role at the top of the list.
5. **Download your server's data regularly.** A snapshot of the layout is what let us rebuild 65 channels in minutes. Keep a record of member roles too; it's the one thing we couldn't restore.
6. **A public mirror isn't a backup.** Answer Overflow's copies of our threads disappeared along with the channels.

---

*Written by Ashish Shekhar (iTeachChem), 16 November 2026. Corrections and offers of help: open an issue on this repository.*
