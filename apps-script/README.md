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
| `App.html` | The search, player and watch-together room (from `app/browser.tsx` and `app/watch/[room]/room.tsx`). |
| `Games.html` | The arcade's games. |
| `Scribble.html` | Scribble, the multiplayer draw-and-guess game. |
| `Showdown.html` | Pokémon Showdown battles, on Showdown's own simulator. |
| `StarSling.html` | Star Sling, a memorial to Angry Birds Star Wars. |
| `Settings.html` | The keys form. |
| `Styles.html` | `app/globals.css`, wrapped in `<style>`. |
| `appsscript.json` | The project manifest. |

## Set it up

1. Create a Google Doc, then open **Extensions → Apps Script**.
2. Replace `Code.gs` with the one here. Add the HTML files with **+ → HTML**,
   named `Index`, `App`, `Games`, `Scribble`, `Showdown`, `StarSling`, `Settings` and `Styles` (no `.html`), and paste each
   one in. To edit `appsscript.json`, turn on **Project Settings → Show
   "appsscript.json" manifest file in editor**.
3. Save, reload the doc, and open **DEBROD → Settings**. Approve the
   permissions, then add your TMDB key, a Real-Debrid and/or TorBox key, and
   the Supabase URL and anon key if you want watch together.
4. Open **DEBROD → Open**.

Or push it with [clasp](https://github.com/google/clasp): run
`clasp clone <scriptId> --rootDir apps-script` once, then `clasp push`.
`.claspignore` keeps `doom/`, `showdown/` and the READMEs out of the project.

### As a web app (optional)

**Deploy → New deployment → Web app** gives the same page full screen at its
own URL. `?page=settings` opens the keys form, and `?room=CODE` is an invite
link.

## The arcade

**Arcade** in the header, next to **Search**, opens Snake, 2048, Blocks,
Breakout, Flap, Pong, Minesweeper, Memory, Star Sling, Doom, Scribble,
Pokémon Showdown and Tic-tac-toe. They work with the keyboard, mouse or touch. Best scores are kept in your browser, and a
timer shows how long you've been procrastinating. Switching back to
**Search** pauses whatever's running.

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

### Built-in Supabase

`DEFAULT_SUPABASE_URL` and `DEFAULT_SUPABASE_ANON_KEY` at the top of
`Code.gs` are used when Settings leaves the Supabase fields blank, so a copy
can ship ready for watch together and Scribble. They're empty here because
this repo is public. Everyone who opens your DEBROD uses your settings, so
friends never need a key of their own.

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
