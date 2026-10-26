# DEBROD

A private, self-hosted movie and TV search for your own Real-Debrid or TorBox
account, with **watch together**: synced playback, chat and emotes for a few
friends. Search TMDB, pick a title or an episode, and see what's already cached
on your debrid account through [Torrentio](https://torrentio.strem.fun). Each
stream can be watched together, played in the page, copied for VLC or Infuse,
or opened in a new tab.

Everything runs on free tiers: **Vercel** hosts it, **Supabase** carries the
watch-together sync, and **GitHub** holds your copy. You bring your own keys;
nothing is shared with anyone else's install.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdoombringer1730%2Fdebrod&project-name=debrod&repository-name=debrod&env=SITE_PASSWORD,TMDB_API_KEY&envDescription=A%20login%20password%20of%20your%20choice%2C%20and%20a%20TMDB%20v3%20API%20key.%20Add%20your%20debrid%20and%20Supabase%20keys%20after%20deploying.&envLink=https%3A%2F%2Fgithub.com%2Fdoombringer1730%2Fdebrod%2Fblob%2Fmain%2F.env.example)

## What you need

| | Cost | Used for |
| --- | --- | --- |
| A [Real-Debrid](https://real-debrid.com) and/or [TorBox](https://torbox.app) account | paid | Finding and streaming cached files |
| A [TMDB](https://www.themoviedb.org/settings/api) API key (v3) | free | Search, posters, seasons and episodes |
| A [Supabase](https://supabase.com) project | free | Watch together (optional) |
| A [Vercel](https://vercel.com) account | free | Hosting |
| A [GitHub](https://github.com) account | free | Your copy of the code |

## Set it up

1. **Supabase (optional, for watch together).** Create a new project. When
   it asks for a database password, generate one and keep it somewhere safe;
   the app never uses it. You don't need any tables. When the project is
   ready, open **Project Settings → API** and copy the **Project URL** and the
   **anon / publishable key**.
2. **Deploy.** Click **Deploy with Vercel** above. It copies this repo into
   your GitHub account and asks for `SITE_PASSWORD` and `TMDB_API_KEY`.
   Or fork the repo, then in Vercel choose **Add New → Project** and import
   your fork.
3. **Add the rest of your keys** in Vercel → your project → **Settings →
   Environment Variables** (see the table below), for Production and Preview.
4. **Redeploy** (Deployments → ⋯ → Redeploy), since variables only apply to
   new deployments. After that, every push to `main` deploys on its own.
5. Open your site, enter your password, and search.

### Environment variables

All of them are listed in [`.env.example`](.env.example).

| Variable | Required | What it is |
| --- | --- | --- |
| `SITE_PASSWORD` | yes | The password for the login page. Without it the site answers 503. Changing it signs everyone out. |
| `TMDB_API_KEY` | yes | TMDB v3 API key. |
| `REALDEBRID_API_KEY` | one of these | From https://real-debrid.com/apitoken |
| `TORBOX_API_KEY` | one of these | From TorBox settings. With both set, results are merged. |
| `SUPABASE_URL` | for watch together | Your Supabase Project URL. |
| `SUPABASE_ANON_KEY` | for watch together | That project's anon / publishable key. |
| `GAMES_LIBRARY_URL` | for a games library | A folder of your games with a `games.json` in it. See [Games](#games). |
| `GAMES_LIBRARY_KEY` | no | The key for that folder, if it's private. |
| `SITE_NAME` | no | The name in the wordmark and tab title. Defaults to `DEBROD`. |
| `TORRENTIO_URL` | no | A different Torrentio instance. Defaults to `https://torrentio.strem.fun`. |

### Run it locally

```bash
npm install
cp .env.example .env.local   # then fill it in
npm run dev
```

## Watch together

**Watch together** on a stream opens a room, and **Invite** copies its link.
Whoever opens it signs in with your password (the link survives the login),
picks a name and lands in sync. Play, pause and seek follow whoever did them,
with a live viewer list, chat and emotes. The link carries the stream plus up
to five backups, so if one dies, everyone moves to the next one together.

How the sync works (`app/watch/[room]/room.tsx`): every viewer sends a
heartbeat every 4 seconds plus an instant message on play, pause or seek. A
rolling-median clock offset against `/api/time` lets a "playing" position be
projected forward by its travel time, and viewers correct themselves when
they drift more than 1.5 s (0.8 s for explicit actions). A newcomer stays quiet
until it hears from the room, so it never pulls everyone back to 0:00.

It uses Supabase Realtime **broadcast and presence only**: no tables, no
accounts, nothing stored. Chat disappears on reload. Realtime's "allow public
access" setting must stay on (it is by default).

## Games

**Games** (top right, or `/games`) is a retro game player in the style of
gam.onl, built on [EmulatorJS](https://emulatorjs.org): NES, SNES, N64, Game
Boy, GBA, DS, Genesis, Master System, Game Gear, Saturn, PlayStation,
TurboGrafx-16, Atari, WonderSwan, Neo Geo Pocket, arcade and more. The
emulator loads from EmulatorJS's CDN (pinned to 4.2.3); saves and save states
stay in the browser.

There are two ways to play:

- **Play a file.** Pick a game file from your device. It is read in your
  browser and never uploaded. The system is guessed from the extension; pick
  it yourself for `.zip`, `.bin`, `.iso`, `.cue` or `.chd`.
- **Your library.** Point `GAMES_LIBRARY_URL` at a folder of your own games on
  any http(s) storage, with an optional `GAMES_LIBRARY_KEY`. The server reads
  the folder with the key and streams files to signed-in browsers through
  `/api/games/file/…`, so the key never reaches a browser. The folder needs a
  `games.json` at its top:

  ```json
  [
    { "name": "My Homebrew", "system": "nes", "file": "nes/my-homebrew.nes", "cover": "covers/my-homebrew.png" }
  ]
  ```

  `file` and `cover` are paths inside the folder; `cover` is optional.
  `system` is one of `nes`, `snes`, `n64`, `gb`, `gba`, `nds`, `vb`,
  `segaMS`, `segaMD`, `segaGG`, `segaCD`, `sega32x`, `segaSaturn`, `psx`,
  `pce`, `atari2600`, `atari7800`, `lynx`, `jaguar`, `ws`, `ngp`, `coleco`,
  `3do` or `arcade`. Disc systems (PlayStation, Saturn, Sega CD) and arcade
  may also need BIOS files, which EmulatorJS doesn't ship.

  A private **Supabase Storage** bucket works well: create a bucket (say
  `roms`), upload your files and `games.json`, then set
  `GAMES_LIBRARY_URL=https://<project>.supabase.co/storage/v1/object/authenticated/roms/`
  and `GAMES_LIBRARY_KEY` to the project's **service_role / secret** key
  (keep that one server-side only; it can read and write everything in the
  project). Vercel functions have time and size limits, so very large disc
  images may not get through; cartridge games are small.

PSP and DOS are left out: their cores need cross-origin isolation, which
would break the rest of the site. Only play games you own and have the right
to copy.

## How it works

- `proxy.ts` sends anyone without a valid session cookie to `/login`. The
  cookie is an HMAC of `SITE_PASSWORD`, httpOnly, and lasts 30 days.
- `app/actions.ts` runs on the server and does the TMDB lookups, so the TMDB
  key never reaches the browser. Every action checks the session again.
- Torrentio's Cloudflare blocks many server IPs, so the **browser** fetches the
  streams (`lib/torrentio.ts`). The server gives a signed-in browser the
  Torrentio URLs to ask.
- "Browser-safe only" hides MKV files and AC3/DTS/TrueHD/Atmos audio, which
  browsers can't play. Turn it off to see everything, then use Copy link with
  an external player.
- Every page sends `noindex`, and `robots.txt` disallows everything.

## Keep it private

- **Your debrid key travels with the streams.** Torrentio's stream links, and
  so the room links, contain it. Anyone you give the password or a room link
  to can see your key. Only share with people you'd trust with your account.
- **Debrid services limit sharing.** Real-Debrid doesn't allow one account to
  be used from more than one internet connection at a time and suspends
  accounts that are shared. TorBox limits simultaneous streams by plan.
  Friends in other homes should use their own accounts and their own install.
- Keep the password to a small group, and don't make your install public.

## Legal

This project hosts no media or games and links to none. It is a search interface for
services you subscribe to yourself. You are responsible for what you stream
and for complying with the copyright law of your country and the terms of
your debrid provider. Use it only for content you have the right to watch.

## License

[MIT](LICENSE)
