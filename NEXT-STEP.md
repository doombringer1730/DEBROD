# Next steps

Where DEBROD stands and what to do next, in priority order. Written against
`898ce75` (room rename). Each item names the files it touches and what "done"
looks like.

## Where it stands

- **Works today:** password login, TMDB search for movies and TV
  (seasons → episodes), Torrentio lookup against Real-Debrid and/or TorBox
  from the browser, in-page playback, copy/open links, and watch together
  (synced play/pause/seek, viewer list, chat, emotes, rename, backup links).
- **Health:** `npm run typecheck` and `npm run build` both pass on Next 16.2.
- **Missing:** tests, lint, and CI. Nothing checks a push before Vercel
  deploys it.

---

## 1. Keep the debrid key out of shared links (security)

**Why:** a room link (`/watch/<id>?s=…&f=…`) carries up to six Torrentio stream
URLs, and every one contains `realdebrid=<key>` or `torbox=<key>`. Pasting an
invite into a group chat hands out the account key. The README warns about
this, but the code can do better.

**Do:**
- Add `lib/seal.ts`: AES-256-GCM `seal(url)` / `open(token)` using a key
  derived from `SITE_PASSWORD` with HKDF (`node:crypto`). Changing the password
  then also kills old links, which matches how sessions already behave.
- Add `app/api/play/[token]/route.ts`. It checks the session (the proxy already
  covers `/api/*`), opens the token, and answers `302` to the Torrentio URL.
- Have the browser get sealed tokens from a new server action
  (`sealStreams(urls)` in `app/actions.ts`). `roomHref` / `parseRoom` in
  `lib/room.ts` then carry tokens instead of URLs, and `room.tsx` plays
  `/api/play/<token>`.
- Keep **Copy link** giving the raw URL. External players (VLC, Infuse) have no
  session cookie.

**Done when:** a room link contains no `realdebrid=` or `torbox=` text, and an
old link stops working after `SITE_PASSWORD` changes.

> The key still shows up in the browser's network tab (the Torrentio fetch and
> the redirect). That's fine for signed-in friends. The aim is to stop it
> leaking through copy-pasted links.

## 2. Tighten the login (security)

- **Slow down guessing.** `app/login/actions.ts` answers a wrong password
  instantly, and the site is on the public internet. Add a fixed delay of
  about 1 s on failure. A real per-IP limit would need storage, so skip that
  for now.
- **Sessions that expire for real.** Today the cookie is the same HMAC forever,
  so `maxAge` is the only expiry and a copied cookie never stops working. Put
  an issued-at time in the token (`<iat>.<hmac(password, iat)>`) and reject
  tokens older than 30 days in `lib/auth.ts#isValidSession`.
- The HMAC label still says `'debrid-search session'`. Leave it as is:
  changing it signs everyone out.

## 3. Add a safety net: CI, lint, a few tests

**Why:** both main files (`app/browser.tsx`, `app/watch/[room]/room.tsx`)
carry most of the logic with no checks. The code has `eslint-disable` comments,
but ESLint isn't installed.

**Do:**
- `.github/workflows/ci.yml` running `npm ci`, `npm run typecheck`, and
  `npm run build` (with dummy `SITE_PASSWORD` / `TMDB_API_KEY`) on every push
  and PR.
- Add ESLint (flat config with `eslint-config-next` and
  `react-hooks`) and a `lint` script, so those disable comments mean
  something.
- Add Vitest with unit tests for the pure parts:
  - `lib/room.ts`: `parseRoom` rejects non-https sources, odd posters, and
    more than 5 fallbacks.
  - `lib/auth.ts`: token/expiry checks (after step 2).
  - The `login` redirect guard: `//evil.com` and `/\evil.com` fall back to `/`.
  - `browserSafe` / `formatSize`: move them from `browser.tsx` into
    `lib/streams.ts` first.
  - The sync math: move `median`, `reconstructPos`, and the drift decision out
    of `room.tsx` into `lib/sync.ts` so they can be tested without a video
    element.

## 4. Make watch together sturdier

These are risks spotted while reading the code, not confirmed bugs. Reproduce
each one before fixing it (two browser windows on the same room are enough).

- **Echoes.** `applySync` raises `applyingRemote` before a seek and clears it
  in `onSeeked`, but play/pause also clear it on a 200 ms timer. If that timer
  fires before `seeked` (slow network, big seek), the remote seek is sent back
  out as a new action. A per-operation flag, or ignoring events within a few
  ms of a remote apply, would be safer.
- **No single source of truth while paused.** Every synced viewer heartbeats
  its own position. Two paused viewers at different spots correct toward each
  other's crossing heartbeats. Consider letting only the last viewer who acted
  send heartbeats (track `lastActor` from `action` payloads).
- **Spoofable `from`.** Anyone in the channel can send any `from` or `name`.
  That's fine for friends. Write it down rather than fix it.
- **Tab in the background.** Browsers throttle `setInterval` in hidden tabs.
  Send a heartbeat on `visibilitychange` back to visible and re-check drift.

## 5. Better stream picking (most of the day-to-day value)

All in `app/browser.tsx` (plus `lib/streams.ts` from step 3):

- **Smarter "browser-safe".** Today it allows only `.mp4` (or no extension)
  and blocks AC3/DTS/etc. It misses **HEVC/x265/10-bit**, which Firefox and
  many browsers can't play, and wrongly hides MKVs that Chrome plays fine.
  Use `document.createElement('video').canPlayType()` with the parsed codec
  hints, and match `x265|HEVC|H\.?265|10bit` in the title.
- **Sort and dedupe.** Sort by resolution, then size. With both services
  set, the same file shows up twice; group by info-hash or filename and show
  both service tags on one row.
- **Ignore stale responses.** Clicking a second title before the first
  finishes can show the first title's streams under the second heading. Keep a
  request counter (or `AbortController`) in `load` / `loadStreams` and drop
  out-of-date results.
- **Deep links.** Put `kind`, `q`, `id`, `s`, and `e` in the URL
  (`useSearchParams` + `router.replace`) so refresh and the back button work,
  and a title can be shared.

## 6. Features worth adding next

Rough order of value per effort:

1. **Next episode** in a TV room: a button that finds the next episode's
   streams and moves the whole room there (a new `switch` broadcast that
   carries the new sources).
2. **Resume where you left off**: save `currentTime` per stream in
   `localStorage` and offer to resume on solo **Play**.
3. **Subtitles**: fetch from a Stremio subtitle add-on (such as OpenSubtitles
   v3) by IMDb id and attach `<track>` elements. This also needs SRT→VTT
   conversion in the browser.
4. **Fallback stream source**: allow a second add-on base URL next to
   `TORRENTIO_URL`, for when Torrentio is down or blocked.
5. **TMDB caching**: add `next: { revalidate: 86400 }` to the `tmdb()` fetch in
   `app/actions.ts` for seasons and episodes.

## 7. Docs and ops

- **README:** Supabase pauses free projects after about a week without
  activity. Check whether Realtime-only use keeps the project awake. If it
  doesn't, say so in "Set it up" and explain how to restore a paused project.
- **README:** after step 1, update "Keep it private" so it no longer says room
  links contain the key.
- Bump `package.json` `version` when the room-link format changes, since old
  links will stop working.

---

## Suggested order

| # | Step | Size | Why first |
| --- | --- | --- | --- |
| 1 | CI + lint (part of §3) | S | Catches breakage before Vercel deploys it |
| 2 | Sealed room links (§1) | M | Biggest real-world risk |
| 3 | Login delay + expiring sessions (§2) | S | Cheap hardening |
| 4 | Extract + test pure logic (rest of §3) | M | Makes §4 and §5 safe to change |
| 5 | Stream picking (§5) | M | Most visible improvement |
| 6 | Sync hardening (§4) | M | Reproduce first, then fix |
| 7 | Features (§6) | M–L | Once the base is solid |
