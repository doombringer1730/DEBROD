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
| `Games.html` | The arcade: Snake, 2048, Breakout and Minesweeper. |
| `Settings.html` | The keys form. |
| `Styles.html` | `app/globals.css`, wrapped in `<style>`. |
| `appsscript.json` | The project manifest. |

## Set it up

1. Create a Google Doc, then open **Extensions → Apps Script**.
2. Replace `Code.gs` with the one here. Add the HTML files with **+ → HTML**,
   named `Index`, `App`, `Games`, `Settings` and `Styles` (no `.html`), and paste each
   one in. To edit `appsscript.json`, turn on **Project Settings → Show
   "appsscript.json" manifest file in editor**.
3. Save, reload the doc, and open **DEBROD → Settings**. Approve the
   permissions, then add your TMDB key, a Real-Debrid and/or TorBox key, and
   the Supabase URL and anon key if you want watch together.
4. Open **DEBROD → Open**.

Or push it with [clasp](https://github.com/google/clasp): run
`clasp clone <scriptId> --rootDir apps-script` once, then `clasp push`.

### As a web app (optional)

**Deploy → New deployment → Web app** gives the same page full screen at its
own URL. `?page=settings` opens the keys form, and `?room=CODE` is an invite
link.

## The arcade

**Arcade** in the header, next to **Search**, opens four small games: Snake,
2048, Breakout and Minesweeper. They work with the keyboard, mouse or touch
(swipe for Snake and 2048). Best scores are kept in your browser, and a
timer shows how long you've been procrastinating. Switching back to
**Search** pauses whatever's running.

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
