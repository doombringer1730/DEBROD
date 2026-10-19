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
| `Settings.html` | The keys form. |
| `Styles.html` | `app/globals.css`, wrapped in `<style>`. |
| `appsscript.json` | The project manifest. |

## Set it up

1. Create a Google Doc, then open **Extensions → Apps Script**.
2. Replace `Code.gs` with the one here. Add the HTML files with **+ → HTML**,
   named `Index`, `App`, `Games`, `Scribble`, `Settings` and `Styles` (no `.html`), and paste each
   one in. To edit `appsscript.json`, turn on **Project Settings → Show
   "appsscript.json" manifest file in editor**.
3. Save, reload the doc, and open **DEBROD → Settings**. Approve the
   permissions, then add your TMDB key, a Real-Debrid and/or TorBox key, and
   the Supabase URL and anon key if you want watch together.
4. Open **DEBROD → Open**.

Or push it with [clasp](https://github.com/google/clasp): run
`clasp clone <scriptId> --rootDir apps-script` once, then `clasp push`.
`.claspignore` keeps `doom/` and the READMEs out of the project.

### As a web app (optional)

**Deploy → New deployment → Web app** gives the same page full screen at its
own URL. `?page=settings` opens the keys form, and `?room=CODE` is an invite
link.

## The arcade

**Arcade** in the header, next to **Search**, opens Snake, 2048, Blocks,
Breakout, Flap, Pong, Minesweeper, Memory, Doom, Scribble, Pokémon
Showdown and Tic-tac-toe. They work with the keyboard, mouse or touch. Best scores are kept in your browser, and a
timer shows how long you've been procrastinating. Switching back to
**Search** pauses whatever's running.

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

**Pokémon Showdown** blocks being shown inside other pages, so its card
opens it in a new tab.

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
