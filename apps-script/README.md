# DEBROD for Google Apps Script

The same search, player and watch together as the Next.js site, plus a
little arcade for procrastinating, running as a Google Apps Script bound to a
Google Doc. It opens from a **DEBROD** menu in
the doc, and can also be deployed as a web app. There's no Vercel, and the
keys live in the script's properties instead of environment variables.

| File | What it is |
| --- | --- |
| `Code.gs` | Server side: the menu, settings, TMDB lookups, Torrentio URLs and room codes. |
| `Index.html` | The page shell. |
| `Account.html` | Sign in, sign up, the approval queue and Huddy's Members tab. |
| `Chat.html` | The public chat: channels, messages, profiles and who's online. |
| `App.html` | The search, player and watch-together room (from `app/browser.tsx` and `app/watch/[room]/room.tsx`). |
| `Hub.html` | Home: the hub, styled as a 70s mission-control console. |
| `Classes.html` | Classes and their shared assignments, inside Study. |
| `Focus.html` | The focus timer and study rooms, on Study's home. |
| `Study.html` | The Study tab: assignments with due dates and turn-in, flashcards, coins and the shop (from Hiranda's old Study section). |
| `Party.html` | The Supabase rooms Color Clash and Sea Battle share. |
| `Cards.html` | Color Clash, the color-matching card game. |
| `Sea.html` | Sea Battle, the hide-your-fleet grid game. |
| `Punch.html` | Punchline, the fill-in-the-blank party game. |
| `PunchCAH.html` | Punchline's optional Cards Against Humanity pack: card text © Cards Against Humanity LLC, under [CC BY-NC-SA 2.0](https://creativecommons.org/licenses/by-nc-sa/2.0/) (so this file is too). |
| `Games.html` | The arcade's games. |
| `Scribble.html` | Scribble, the multiplayer draw-and-guess game. |
| `Showdown.html` | Pokémon Showdown battles, on Showdown's own simulator. |
| `Notify.html` | Sitewide notifications: pop-ups and the 🔔 bell (mentions, class work, new boards, sign-ups, Huddy's announcements). |
| `Boards.html` | Group whiteboards in Study, live over Supabase Realtime. |
| `Words.html` | Word games in the arcade: Five, Groups, Hive, Letter Box and the Mini crossword. Their word lists load from `words/words.json` on jsDelivr. |
| `StarSling.html` | Star Sling, a memorial to Angry Birds Star Wars. |
| `Emulator.html` | The arcade's Retro consoles (EmulatorJS) and the PokéRogue and Oregon Trail cards. |
| `Settings.html` | The keys form. |
| `Styles.html` | `app/globals.css`, wrapped in `<style>`. |
| `Themes.html` | Each page's look (see [Looks](#looks)). |
| `appsscript.json` | The project manifest. |

Changing these files or adding one? See [SCRIPTS-GUIDE.md](SCRIPTS-GUIDE.md).

## Set it up

1. Create a Google Doc, then open **Extensions → Apps Script**.
2. Replace `Code.gs` with the one here. Add the HTML files with **+ → HTML**,
   named `Index`, `App`, `Account`, `Notify`, `Chat`, `Themes`, `Hub`, `Study`, `Classes`, `Focus`, `Boards`, `Party`, `Cards`, `Sea`, `PunchCAH`, `Punch`, `Words`, `Emulator`, `Games`, `Scribble`, `Showdown`, `StarSling`, `Settings` and `Styles` (no `.html`), and paste each
   one in. To edit `appsscript.json`, turn on **Project Settings → Show
   "appsscript.json" manifest file in editor**.
3. Save, reload the doc, and open **DEBROD → Settings**. Approve the
   permissions, then add your TMDB key, a Real-Debrid and/or TorBox key, and
   the Supabase URL and anon key if you want watch together. A YouTube Data
   API key adds YouTube to Search.
4. Open **DEBROD → Open**.

Or push it with [clasp](https://github.com/google/clasp): run
`clasp clone <scriptId> --rootDir apps-script` once, then `clasp push`.
`.claspignore` keeps `doom/`, `showdown/` and the READMEs out of the project.

### As a web app (optional)

**Deploy → New deployment → Web app** gives the same page full screen at its
own URL. `?page=settings` opens the keys form, and `?room=CODE` is an invite
link (as are `?scribble=`, `?showdown=`, `?cards=` and `?sea=` for the games).

## Accounts

DEBROD opens on a sign-in screen. **Sign up** asks for a username,
display name and password and puts the account in Huddy's queue; until
Huddy approves it, that person only sees "You're in the queue" (it lets
them in on its own the moment they're approved). Huddy gets a **Members**
tab, with a count of who's waiting, to approve or turn down sign-ups, lock
someone out, reset a forgotten password, or delete an account.

It's more than a screen: every search, stream lookup and room in `Code.gs`
checks the caller's session with Supabase and answers approved members
only, so a shared web app link gets nobody in on its own. For friends
without access to the doc, deploy the web app with **Execute as: Me** and
**Who has access: Anyone**; the sign-in screen is the gate.

Setting it up (already done for DEBROD's own Supabase project):

1. Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL
   editor. It also sets up the chats, shared deadlines and Study sync
   tables for what's coming next.
2. Deploy [`supabase/functions/debrod-auth`](supabase/functions/debrod-auth/index.ts)
   as an Edge Function named `debrod-auth`, with **Verify JWT** off.
3. Sign up as **huddy** right away: while there's no admin, that name is
   approved and made admin on the spot.

Logins are usernames; behind the scenes each is a Supabase Auth user with a
made-up `@debrod.example.com` address nobody receives, so there's no email
reset. Huddy resets passwords from Members instead.

## Chat

**Chat** is a public, Discord-style chat for everyone approved: channels
down the left (#general, #study-hall, #games, #watch-party, #off-topic),
messages in the middle, and the members list on the right with who's
online. Messages arrive live; you can edit or delete your own (Huddy can
delete anyone's), `@username` highlights the message for that person,
and links work. The Chat tab counts what came in while you were elsewhere.

Everyone has a **profile**: an avatar emoji and colour, a status line and
a short bio. Click anyone's name or avatar to see theirs; edit yours from
the bottom of the channel list. Huddy can add, rename and delete channels.

### The filter

Swears and slurs turn into `***` in messages, display names, status lines
and bios. The database does it as things are saved, so nothing gets around
it: whole words only (so "class", "spicy" and "Scunthorpe" are fine), and it
catches l33t spellings (`sh1t`, `f@g`), dots between letters (`f.u.c.k`),
stretched letters (`fuuuck`) and endings (`-ing`, `-er`, `-s`). Huddy edits
the word list under **Members → Chat filter**. Posting more than 6
messages in 10 seconds gets a "Slow down" too.

## Home

DEBROD opens on **Home**, a hub dressed as a 70s mission-control console.
It shows what's due in Study,
games to jump back into (with Star Sling's endless level), a quick search
and watch-party join, and **Online now**: everyone else on your DEBROD,
what they're doing, and a **Join** button for their Scribble, Showdown,
Color Clash or Sea Battle room or watch party. That's live Supabase presence,
nothing stored; flip **Show me** off to hide (you then see nobody either).

## Looks

Every page is a different decade's idea of the future, done the way it
was printed or built at the time (all in `Themes.html`, except Study's,
which lives in `Study.html`):

| Page | Look |
| --- | --- |
| Home | A 70s mission-control console: charcoal panels, amber screens, chunky keys. |
| Search | A 1958 TV listings magazine: newsprint, two inks slightly off register, a starburst masthead, every poster a walnut TV set. |
| Arcade | A 1977 woodgrain console: ribbed black plastic, the rainbow stripe, aluminium switches, games as cartridges, and the game itself on a woodgrain TV. |
| Study | A 1964 punch-card computer room: manila cards with the corner cut, green-bar printout, keypunch keys, and flashcards with holes punched. |
| Chat | A 1984 one-bit desktop: dithered grey, white windows with pinstriped title bars, inverted selections. The only colour is people's avatars. |
| Members | A 1961 personnel file: a manila folder, typewritten index cards and rubber stamps for who's cleared. |
| Sign in | A Space Clipper boarding pass with a torn-off stub. |

The watch-together room keeps the original neon, like a cinema.

Every tab opens with a second of an old terminal booting it up; a click or
any key skips it, and it's off for anyone with reduced motion turned on.

## YouTube

**Search** has a **YouTube** tab next to Movies and TV shows. Pick a video
to play it right there, or **Watch together** to open a room for it: the
same room, chat and invite code as a stream, kept in sync through
YouTube's own player.

It needs a YouTube Data API key (enable **YouTube Data API v3** in Google
Cloud, then make a key under **Credentials**). Put it in **DEBROD →
Settings**, or in `DEFAULT_YOUTUBE_API_KEY` at the top of `Code.gs` so
everyone on your DEBROD can search without one. The key stays on the
server either way. It's empty here because this repo is public; keep a
filled-in `Code.gs` out of GitHub. Each search uses 100 of the key's
10,000 free daily units, so about 100 searches a day.

## The arcade

**Arcade** in the header opens Snake, 2048, Blocks, Breakout, Flap, Pong,
Minesweeper, Memory, Star Sling, Doom, Scribble, Punchline, Color Clash,
Sea Battle, Pokémon Showdown, Retro consoles, PokéRogue, The Oregon Trail
and Tic-tac-toe. They work with the keyboard, mouse or touch. Best scores are kept in your browser, and a
timer shows how long you've been procrastinating. Switching back to
**Search** pauses whatever's running.

**Retro consoles** plays games for NES, SNES, N64, Game Boy and Color,
GBA, DS, Virtual Boy, Master System, Genesis, Game Gear, Sega CD, 32X,
Saturn, PlayStation, TurboGrafx-16, Atari 2600/7800/Lynx/Jaguar,
WonderSwan, Neo Geo Pocket, ColecoVision, 3DO and arcade, in the style of
gam.onl, on [EmulatorJS](https://emulatorjs.org) (pinned to 4.2.3, loaded
from its CDN). Saves and save states stay in the browser. There are two
ways to play:

- **Play a file:** pick a game file on your device. It's read in your
  browser and never uploaded. The system is guessed from the extension;
  pick it yourself for `.zip`, `.bin`, `.iso`, `.cue` or `.chd`.
- **Your library:** in **DEBROD → Settings**, set **Games library URL** to
  a folder of your own games on any http(s) storage, and **Games library
  key** if it's private. `Code.gs` fetches from it with the key (sent as
  `Authorization: Bearer <key>` and `apikey`), so the key never reaches a
  browser. The folder needs a `games.json` at its top:

  ```json
  [
    { "name": "My Homebrew", "system": "nes", "file": "nes/my-homebrew.nes" }
  ]
  ```

  `file` is a path inside the folder, and `system` is one of `nes`, `snes`,
  `n64`, `gb`, `gba`, `nds`, `vb`, `segaMS`, `segaMD`, `segaGG`, `segaCD`,
  `sega32x`, `segaSaturn`, `psx`, `pce`, `atari2600`, `atari7800`, `lynx`,
  `jaguar`, `ws`, `ngp`, `coleco`, `3do` or `arcade`. Files travel through
  Apps Script, so they're capped at 40 MB: cartridge games are fine, most
  disc images aren't. Disc systems and arcade may also need BIOS files,
  which EmulatorJS doesn't ship. A private Supabase Storage bucket works
  as the library: use
  `https://<project>.supabase.co/storage/v1/object/authenticated/<bucket>/`
  and the project's secret (service_role) key, which stays in Script
  Properties.

PSP and DOS aren't offered: their cores need cross-origin isolation, which
Apps Script's frame can't turn on. Only play games you own.

**PokéRogue** (the free fan-made Pokémon roguelite) and **The Oregon
Trail** (the 1990 MS-DOS version, from the Internet Archive) play from
their own sites inside the arcade. **New tab** opens them on their own if
signing in or saving doesn't work in the frame.

**Star Sling** is a memorial to Angry Birds Star Wars (Rovio, 2012), which
was pulled from the app stores in 2019 and can't be played anymore. It's
recreated in the original's shape: seven levels across its three episodes
(a desert planet, a battle station with low gravity and a gravity well
that bends your shots, and an ice planet), towers of glass, wood and steel
that really topple, helmeted troopers and a dark-helmeted commander, and
heroes with the original's powers. The Rookie spins a beam blade, the
Gunner fires three blaster bolts wherever you tap, the Sage pushes
everything away, and the Brute is just very heavy. Drag back from the sling
and let go, or aim with the arrows and fire with Space. Tap or press Space
mid-flight to use the hero's power. Heroes you don't need are worth a bonus.

Besides the original seven levels there's **Endless**: random levels,
forever. Each run has its own seed, the episodes take turns every three
levels (with low gravity and sometimes a gravity well on the station), and
the forts get bigger and tougher the further you go. Every layout is
checked to stand up on its own before you see it. Your run saves after each
level, so **Continue** on the title card picks up where you left off, on
the same layout. Run out of heroes and you can retry the level from the
score you came in with, or ask for a new layout of it.
It's a fan tribute with its own names and art, not the original game or
its characters, and isn't made by or affiliated with Rovio or Lucasfilm.

**Punchline** is the fill-in-the-blank party game, dressed as a school
lunchroom: a rotating judge chalks a prompt on the "Today's special" board,
everyone else plays their funniest answer from a lunch tray of 10 (some
prompts take 2 or 3), the answers are read out anonymously with the
sentence filled in, and the judge's favourite scores a milk carton. First
to 5, 7 or 10 wins. 3 to 10 people online (`?punch=CODE`), plus up to
three House bots that play a random card, so two friends can play. The
host picks the packs: **Punchline** (original cards), **Lunchroom**,
**Spicy** (crude humour; swear words are blurred until you hover or press
them), **Cards Against Humanity** (the official main deck, 18+, from
`PunchCAH.html`, © Cards Against Humanity LLC under CC BY-NC-SA 2.0; six
cards that put children in a sexual context are left out), and **Custom**
(one card per line; lines with a ____ are prompts). Punchline isn't made
by or affiliated with Cards Against Humanity.

**Color Clash** is the colour-matching card game: 108 cards with Skips,
Reverses, +2s, Wilds and Wild +4s (only when you hold none of the current
colour), an optional "stack +2/+4" rule, and **Last card!**, which anyone
can catch you forgetting for +2. Rounds score the cards left in everyone
else's hand; first to 500 wins. Play up to five CPUs, or 2 to 6 people
online (**Invite** gives a `?cards=CODE` link): the room's creator runs the
game, the CPU takes empty seats and anyone who leaves (they get the seat
back if they return), someone else takes over if the host leaves, and each
turn has a 30-second clock. Like Showdown, it isn't cheat-proof.

**Sea Battle** is the hide-your-fleet grid game: place five ships (R
rotates, or Random), then take turns firing. Play the CPU on Easy, Normal
(hunts, then finishes ships off) or Hard (works out where ships can still
be), or a friend online with a `?sea=CODE` link, with anyone else
watching. Online, each fleet stays on its owner's page: shots and answers
go back and forth, and at the end both fleets are revealed and checked
against a fingerprint sent at the start, so you'll see "✔ Fair game" or
a warning. There's a 30-second shot clock, and rematches alternate who
fires first.

**Doom** is [DoomPDF](https://github.com/ading2210/doompdf)'s engine, taken
out of the PDF and drawn on a canvas, with the shareware episode. Its files
live in [`doom/`](doom) and load from jsDelivr the first time you open it
(about 5 MB). There's no sound. Arrows or WASD move, Ctrl or Space fires, E
uses, Shift runs, M shows the map, and Esc or <kbd>`</kbd> opens the menu. In
the doc dialog, Esc may close the dialog, so use <kbd>`</kbd>. Phones get
on-screen buttons. Doom's code is GPL v2: see [`doom/README.md`](doom/README.md).

**Scribble** is DEBROD's own skribbl.io: take turns drawing a word while
everyone else races to guess it, 2 to 12 players. It runs over the same
Supabase Realtime as watch together, with nothing stored. **Create a room**,
then **Invite** copies a `?scribble=CODE` link (in the web app) or the room
code (in the doc). Friends sign in to your DEBROD and land in the room. The
room's creator hosts: they set the rounds and draw time, can add their own
words (mixed in with the built-in list, or on their own), and run the clock
and scores. Everyone picks an icon, and the board sizes itself to fit the
screen. If they leave, the longest-present player takes over. The word
only goes out as a salted hash until the turn ends, so nobody can read it
off the network by accident, but it isn't cheat-proof. Your room survives a
trip to **Search**; going back to the arcade's game list leaves it.

**Pokémon Showdown** runs Showdown's own battle simulator right in the page
(play.pokemonshowdown.com won't load inside other sites), against the CPU or
a friend over the same Supabase as Scribble. The host's page runs the
battle, the guest sends their moves, and anyone else in the room watches.

- **Formats:** Random Battles for Gens 1–9, Random Doubles, Baby Randoms,
  Challenge Cup and Hackmons Cup; and bring-your-own-team OU, Ubers, UU,
  RU, NU, LC, Monotype, National Dex, 1v1, Anything Goes, Doubles OU,
  VGC 2025 Reg I, Battle Stadium Singles and Custom Games. Teams are checked
  by Showdown's own validator.
- **Team builder:** Showdown's import/export text, every field (item,
  ability, Tera type, nature, EVs, IVs, level, shiny), move suggestions from
  each Pokémon's learnset, random teams, and saved teams in your browser.
- **Battles:** singles and doubles (with targeting), team preview,
  Terastallization, Mega Evolution, Z-Moves and Dynamax, tooltips for every
  Pokémon and move, weather, terrain and hazards on the field, cancel,
  forfeit, a turn timer and chat for online battles, Showdown's music and
  cries, adjustable speed, and **Replay ⤓**, which saves a file that plays
  back in Showdown's replay viewer.
- **DEBROD extras Showdown doesn't have:**
  - **Draft Battle / Draft Doubles:** both players snake-draft six from a
    pool of 16 random Pokémon, then battle with what they picked. Works
    against the CPU or a friend, with a 45-second pick clock online.
  - **Draft Free-for-all:** four trainers snake-draft four each from a pool
    of 24, then it's everyone against everyone. Draft against three CPUs or
    with up to three friends; the CPU picks for any empty seat, and for
    anyone who leaves mid-draft.
  - **4 players:** Free-for-all Random Battle (everyone against everyone,
    last one standing) and Multi Random Battle (2 vs 2, one Pokémon each).
    Play three CPUs, or open a room for up to three friends; the CPU takes
    any empty seat, **Change partners** picks your Multi teammate, and if
    someone leaves mid-battle the CPU plays for them after 20 seconds.
    Anyone past the fourth watches. Showdown itself doesn't offer Free-for-all
    random teams, so these use ordinary random-battle sets.
  - **Battle Tower:** a streak against the CPU with a rental team. Every
    floor's trainer is stronger and smarter, a Tower Tycoon waits every 7th
    floor, and after a win you can swap in one of the Pokémon you beat.
    Your best floor is saved.
  - **💡 Coach:** every move shows how it matches up against the Pokémon
    across the field (×2, ×½, no effect), and the best pick is marked.
  - **Effects:** type-coloured move beams and bursts, damage and healing
    numbers, a screen shake for crits and super-effective hits, and rain,
    sun, sand, snow and terrain on the field.
  - **MVP:** the end screen shows who dealt the most damage and KOs.
  - **Emotes** fly across the field, for both sides online; the CPU reacts
    too.
  - Your win/loss record per format.

**Invite** gives a `?showdown=CODE` link in the web app. The engine lives in
[`showdown/`](showdown) and loads from jsDelivr the first time (about 1 MB).
Sprites and sound come from Showdown's own servers.

**Look** (on the Showdown menu, remembered): Neon (the arcade's own),
Pokédex (red casing, pale screen), Stadium (a sunny N64 arena), Midnight
(quiet and dark) or Game Boy (four greens, a pixel font, green sprites),
plus an accent colour from the swatches or any colour you like. Game Boy
keeps its greens.

**CPU difficulty** (on the Showdown menu, remembered): Easy picks almost at
random; Normal goes for super-effective hits; Hard works out real damage,
goes for knockouts, uses status moves only when they'd help and switches
into the best matchup; Expert does all that without ever slipping, and
won't attack into Levitate or Water Absorb. It applies to every CPU,
four-player and draft ones included. The Battle Tower ramps on its own.

### Built-in Supabase

`DEFAULT_SUPABASE_URL` and `DEFAULT_SUPABASE_ANON_KEY` at the top of
`Code.gs` are used when Settings leaves the Supabase fields blank, so a copy
can ship ready for watch together and Scribble. They point at DEBROD's own
Supabase project (`zppygyfzbwbusidmqlru`); the publishable key is meant for
browsers. Everyone who opens your DEBROD uses your settings, so friends
never need a key of their own.

### Pokémon leaderboard

Home's **Pokémon leaderboard** ranks everyone by points from their
Showdown wins: Easy 1, Normal 2, Hard 3, Expert 5, beating a real person 4,
each Battle Tower floor 2. It also shows wins and losses, win rate, Expert
wins, wins against people and best tower floor. Every finished battle is
saved to Supabase under your account (one result per 15 seconds at most).

## Study

**Study** is Hiranda's old Study section (as it was before it became
Grow), now saved to your account: assignments with due
dates ("2d overdue", "due today", "in 4 days"), turned in once for XP and
coins, on a month calendar; flashcard sets you can paste in, studied with
Learn, Write, Quiz, Match, Flashcards or spaced-repetition Review; and
health, coins with a daily cap, a weekly XP goal, an activity log,
personal bests and a reward shop to spend coins in. **Export** saves a
backup file and **Import** loads one.

- **Sync.** Study saves to your account a moment after every change and
  loads when you sign in, so it follows you between devices (a badge says
  whether it's synced). The newer copy wins; the first time a browser
  links to an account the two copies are merged. If someone else signs
  in on the same browser, their own Study replaces what's there and the
  previous copy is set aside, not deleted.
- **Classes.** Anyone can make a class; everyone can browse and join.
  Members post its assignments, tests, quizzes, projects and readings with
  a due date, **what each one entails** and a link. Everyone in the class
  gets them in their Study assignments, tagged with the class: click one
  for the details, turn it in for XP, see it on the calendar and on Home.
  Hiding one only hides it for you; the poster or Huddy can edit or take
  it down.
- **Focus.** A study timer: 25, 50 or 90 minutes, then a break. Every
  minute focused is 1 XP (plus coins under the daily cap); stop early and
  5+ minutes still count. Study with others in the always-open **Study
  hall** or a room code: one timer for everyone, anyone can start or pause
  it, and Home's Online now shows who's in with a Join button.
- **Study leaderboard** on Home: XP this week, focus time, cards reviewed,
  streak and all-time XP for everyone, from what their Study sync reports.

## Apps Script gotchas

Two things about how Google serves these pages, learned the hard way:

- **Google strips comments from the served page, badly.** Its stripper
  understands `'…'` and `"…"` strings but not backtick strings or regexes,
  so a `//` inside either looks like a comment and the rest of the line is
  deleted, breaking the script. Inside backticks write `/\/` (it means
  `//`); in a regex write `[/]` for `/`. The source still reads fine; only
  the served copy breaks, so test the deployed page.
- **The browser's `confirm()`, `alert()` and `prompt()` often don't show**
  inside Google's sandboxed frame, and `confirm()` quietly answers no. Use
  `ask()`, `tell()` and `showText()` from App.html instead; they draw the
  box on the page.

## How it differs from the site

- **No site password.** Whoever can edit the doc, or reach the web app
  deployment, can use it.
- **Rooms are codes.** **Watch together** keeps what's playing in the script
  cache under an 8-character code for six hours (CacheService's maximum).
  **Invite** shows the code, and the web app link when it's deployed. Friends
  enter the code under the search box.
- **The clock** for sync is the script's `getTime` instead of `/api/time`.
  That's a slower round trip, but the rolling median absorbs it.
- Torrentio and Supabase are still reached from the page itself, as on the
  site.

## Keep it private

- Deploy the web app with **Execute as: Me** and **Who has access: Only
  myself**, or only to people you'd trust with your debrid account.
  Everyone who can open it can fetch stream links, and those carry your
  debrid key. Only the account the script runs as can read or change the
  settings.
- The rest of [Keep it private](../README.md#keep-it-private) in the main
  README applies here too.
