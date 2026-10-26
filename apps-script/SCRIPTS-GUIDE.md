# Working on DEBROD's script files

How to get at the files that make up DEBROD, how they fit together, and the
rules for changing them or adding a new one without breaking the live page.
For what each feature does, see [README.md](README.md).

## Where the files are

There are two copies, and they need to match:

| Copy | Where | Who reads it |
| --- | --- | --- |
| **The repo** | `apps-script/` in [doombringer1730/DEBROD](https://github.com/doombringer1730/DEBROD) | You, Claude, `clasp`, and jsDelivr (for the big data files) |
| **The Apps Script project** | The Google Doc → **Extensions → Apps Script** | Google; this is what actually runs |

The repo is the source of truth. Make changes there, then copy them into
Apps Script. If you edit in Apps Script directly, copy the change back to
the repo afterwards, or the next paste will overwrite it.

## Getting at the files

### Reading them

- **On GitHub:** open the repo, then `apps-script/`, then any file. The
  **Raw** button gives plain text you can copy.
- **In Apps Script:** the left sidebar lists every file. `Code.gs` is the
  server, everything else is an HTML file.
- **`appsscript.json`** is hidden by default. Turn on **Project Settings →
  Show "appsscript.json" manifest file in editor**.

### Writing them into Apps Script by hand

1. Open the Doc, then **Extensions → Apps Script**.
2. **To change a file:** click it, select all (Ctrl+A / ⌘A), delete, and paste
   the new version.
3. **To add a file:** click **＋ → HTML**, type the name **without** `.html`
   (for example `Notify`, not `Notify.html`), and paste the contents. The name
   has to match exactly, capital letters included, because `Index.html` loads
   files by name.
4. Click **Save** (the disk icon, or Ctrl+S / ⌘S).
5. Deploy a new version (see [Putting changes live](#putting-changes-live)).

### Writing them with clasp (no copy-pasting)

[clasp](https://github.com/google/clasp) pushes the repo's files straight
into the Apps Script project.

```sh
npm install -g @google/clasp
clasp login                                         # once, opens Google sign-in
clasp clone <scriptId> --rootDir apps-script        # once; the ID is in Project Settings
clasp push                                          # every time you change something
```

`.claspignore` keeps out the folders that shouldn't go to Google: `doom/`,
`showdown/`, `words/`, `supabase/` and the `.md` files. The big engine and
data files load from jsDelivr instead (see
[Big data files](#big-data-files-jsdelivr)).

## Putting changes live

Saving isn't enough for the web app. Each deployment is frozen at a version.

1. **Deploy → Manage deployments**.
2. Click the ✎ pencil on your web app deployment.
3. **Version → New version**, then **Deploy**.

The URL stays the same. The Doc menu (**DEBROD → Open**) always runs the
latest saved code, so it's a quick way to test before deploying.

## How the page is put together

`Code.gs` serves `Index.html`, and `Index.html` pulls in every other file
with lines like this:

```html
<?!= include('Notify') ?>
```

`include()` in `Code.gs` pastes that file's contents in place, so the
browser gets one big page. **The order matters**: a file can only use what
the files above it define. The order is:

1. `Styles`, `Themes`: CSS only.
2. `App`: the shared helpers everything else uses (see
   [What's shared](#whats-shared-apphtml)).
3. `Account`, `Notify`, `Chat`, `Hub`, `Study`, `Classes`, `Focus`, `Boards`.
4. The games: `Party`, `Cards`, `Sea`, `PunchCAH`, `Punch`, `Scribble`,
   `Showdown`, `StarSling`, `Words`, `Emulator`.
5. `Games` last, since it lists the games from the files above.

Calls *across* modules at run time (say, `Study` calling `Boards.panel()`)
can point either way. Guard them with `typeof Boards !== 'undefined'` so the
page still works if a file is missing.

## Writing a file

Every HTML file follows the same shape: optional styles, then one script
that defines a single module object.

```html
<style>
/* ── Thing: what it is (where its look comes from) ── */
.th-box { display: flex; gap: 8px; }
</style>
<script>
// Thing: one or two sentences on what this file does and where it's used.

const Thing = (() => {
  let started = false

  function start() {
    if (started || typeof Account === 'undefined' || !Account.ready()) return
    started = true
    // ...
  }

  function stop() {
    started = false
  }

  return { start, stop }
})()
//# sourceURL=debrod/Thing.js
</script>
```

- **One global per file.** Wrap everything in `const Thing = (() => { … })()`
  and return only what other files need.
- **End every script with `//# sourceURL=debrod/<Name>.js`.** Errors then
  name the file instead of a mystery line in a huge page.
- **Prefix your CSS classes** (`.ch-` Chat, `.st-` Study, `.bd-` Boards,
  `.nt-` Notify, `.wg-` word games, `.pk-` Showdown) so they don't collide.
- **Build the page with `el()`**, never `innerHTML`, so text from people (and
  TMDB) can't inject markup.

### Adding the new file everywhere it needs to go

1. Create it in `apps-script/`.
2. Add `<?!= include('Thing') ?>` to `Index.html`, in the right place in the
   order.
3. Add a row to the file table in `README.md`, and its name to the list in
   **Set it up**.
4. **If it's a game,** add an entry to `GAMES` in `Games.html`:

   ```js
   { id: 'thing', name: 'Thing', icon: '🎲', blurb: 'One line.', hint: 'How to play.',
     start: fromFile(typeof thing === 'function' ? thing : null, 'Thing'), noScore: true, noRestart: true },
   ```

   `start(host, ctx)` draws into `host` and returns
   `{ stop(), key?(e, down) }`. `ctx` has `toast()`, `score()`, `end()` and
   `best()`. `fromFile` shows a "file missing" card if `Thing.html` wasn't
   pasted in.
5. In Apps Script, make the new HTML file with exactly the same name.

## The two rules that break the live page

These only bite **after deploying**, because they're about how Google serves
the page. Your file can look perfect and still break.

### 1. No `//` inside backticks or regexes

Google strips comments from the served page, and its stripper doesn't
understand template strings (backticks) or regexes. A `//` inside either
looks like a comment, and the rest of the line gets deleted.

| Don't write | Write instead |
| --- | --- |
| `` `https://${host}/path` `` | `` `https:/\/${host}/path` `` (`/\/` still means `//`) |
| `/^https:\/\//` | `/^https:[/][/]/` |

Plain `'…'` and `"…"` strings are fine. Real comments (`// like this`) on
their own are fine too.

### 2. No `confirm()`, `alert()` or `prompt()`

Google's sandboxed frame blocks them, and `confirm()` silently answers
"no", which is why deleting once did nothing. Use the on-page versions from
`App.html`:

```js
if (!(await ask('Delete this?', 'Delete'))) return   // yes/no, a Promise<boolean>
tell('Saved.')                                       // a message with OK
showText('Copy this:', someText)                     // text they can copy
```

## What's shared (App.html)

| Helper | What it does |
| --- | --- |
| `el(tag, props, ...kids)` | Makes an element. `onClick` etc. become listeners; `false`/`null` kids are skipped. |
| `call(fn, ...args)` | Calls a `Code.gs` function, returns a Promise. |
| `member(fn, ...args)` | Same, but adds the signed-in member's token first. Use it for anything `Code.gs` gates. |
| `ask()`, `tell()`, `showText()` | The dialogs above. |
| `face(person)` | What goes in an avatar circle: their photo, or their emoji. |
| `copyText(text)` | Copies to the clipboard, returns whether it worked. |
| `S`, `render()` | The app's state (`S.tab` is the open tab) and a redraw. |

From `Account.html`: `Account.ready()`, `Account.profile()` (you:
`id`, `username`, `display`, `avatar`, `photo`, `is_admin`…),
`Account.isAdmin()`, and `Account.client()`, the signed-in Supabase client.

From `Notify.html`: `Notify.push({ title, body, icon, tab, loud })` shows a
pop-up and adds it to the bell.

## Talking to Supabase

Use `Account.client()`. It's signed in as the person using the page, so the
database's own rules (row-level security) decide what they can see and
change. A page can't get around them.

```js
const auth = Account.client()
const { data, error } = await auth.from('debrod_boards').select('id, name').order('created_at')
if (error) return tell(error.message)
```

Live updates come from Realtime channels:

```js
const live = auth.channel('debrod-thing')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'debrod_thing' }, ({ new: row }) => { /* ... */ })
  .subscribe()
// when you're done: auth.removeChannel(live)
```

**New tables** go in `supabase/schema.sql` along with their rules: enable
row-level security, add policies (use `debrod_approved()`, `debrod_admin()`
and `debrod_in_class(id)`), grant to `authenticated`, revoke from `anon`, and
add the table to the `supabase_realtime` publication if pages listen to it.
Run the new part in the Supabase SQL editor. Text people type should go
through `debrod_clean()` in a trigger so the word filter applies.

Main tables: `debrod_profiles` (accounts), `debrod_chat` / `debrod_channels`,
`debrod_study`, `debrod_classes` / `debrod_class_members` /
`debrod_class_work`, `debrod_boards` / `debrod_board_strokes`,
`debrod_announcements`, `debrod_pk_results`, `debrod_banned_words`. Profile
photos are in the `debrod-avatars` storage bucket.

## Saving things in the browser

`localStorage` works but can throw (private mode), so always wrap it:

```js
try { localStorage.setItem('ds_thing', JSON.stringify(value)) } catch (e) { /* private mode */ }
```

Start keys with `ds_`. Anything that must reach other people or other
devices belongs in Supabase, not here.

## Big data files (jsDelivr)

Apps Script can't serve large files, so the Showdown engine
(`showdown/showdown.js`), Doom (`doom/`) and the word lists
(`words/words.json`) are loaded from GitHub through jsDelivr, pinned to a
commit:

```
https://cdn.jsdelivr.net/gh/doombringer1730/DEBROD@<commit>/apps-script/words/words.json
```

To update one: commit the new file, then change the `<commit>` in the URL
(`WORDS_URL` in `Words.html`, `SHOWDOWN_BASE` in `Showdown.html`) to that
commit's ID. Don't paste these files into Apps Script.

## Keys and secrets

- **Never commit keys.** `Code.gs` in the repo has
  `const DEFAULT_YOUTUBE_API_KEY = ''` on purpose. Put the real key only in
  the Apps Script copy, or in **DEBROD → Settings** (stored in Script
  Properties).
- The Supabase URL and publishable (anon) key in `Code.gs` are fine to
  share; they're meant for browsers, and row-level security does the
  protecting.
- TMDB, Real-Debrid, TorBox and games library keys live in Script Properties through
  **DEBROD → Settings**, and never go back to the page.

## Before you paste

1. **Check the syntax:** load the page and open the browser console (F12). An
   error names the file, thanks to `sourceURL`.
2. **Search your change for `//`** inside backticks or regexes.
3. **Search for `confirm(`, `alert(` and `prompt(`.**
4. **New file?** It's in `Index.html` (and `Games.html` if it's a game), and
   it has the same name in Apps Script.
5. **New table?** It's in `supabase/schema.sql` and has been run in
   Supabase.
6. **Deploy a new version**, then test the deployed link, not just the Doc
   menu.

If the deployed page shows only the startup screen, wait 15 seconds: it lists
the first error it hit, and that error names the file to look at.
