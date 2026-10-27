# The homework pilot

A small, opt-in pilot inside DEBROD's Study page. For each student who
signs up, it shows their real assignments and due dates from Veracross,
pays coins when they turn work in, and lets them spend those coins on a
few minutes of DEBROD's arcade, up to a daily limit. It never writes to
Veracross, never reads grades, and deletes everything at the end.

This page is in two parts: [setting it up](#setting-it-up), and
[what it reads, stores and deletes](#for-school-it-security-and-privacy),
written for the school's IT team to review.

| Part | File |
| --- | --- |
| Database tables, access rules, coin rules | [`supabase/homework.sql`](supabase/homework.sql) |
| The Veracross sync (Edge Function) | [`supabase/functions/debrod-veracross-sync/`](supabase/functions/debrod-veracross-sync/) |
| The Veracross client, and the made-up data | [`veracross.ts`](supabase/functions/debrod-veracross-sync/veracross.ts) |
| The pages: Homework in Study, Huddy's admin page, the arcade's coin gate | [`Homework.html`](Homework.html) |
| Tests | [`veracross.test.ts`](supabase/functions/debrod-veracross-sync/veracross.test.ts), [`supabase/tests/`](supabase/tests/) |

## How it works

1. A scheduled job calls the `debrod-veracross-sync` Edge Function 4 times
   each school day. It gets a short-lived token from Veracross with the
   school-issued client ID and secret (OAuth 2.0 client credentials).
2. It reads enrollments, classes, assignments and completion status, and
   keeps only rows for students linked in the pilot.
3. It saves class names, assignment titles, due dates and a completion
   status (pending, turned in, late, missing or excused) for those
   students.
4. The database pays coins for each assignment turned in: **10 on time,
   3 late**, once per assignment, no matter how many times the sync runs or
   the status flips.
5. Students see their own list and balance in **Study → Homework**, and
   spend **20 coins for 10 minutes** of arcade, up to **30 minutes a day**.
   Huddy can change all four numbers.

Teachers keep entering assignments and marking completion in Veracross
exactly as they do now.

## Setting it up

### 1. The database

In the Supabase project's **SQL Editor**, run
[`supabase/homework.sql`](supabase/homework.sql) (after `schema.sql`, which
is already there for DEBROD). Running it again is safe.

### 2. The sync function

Deploy [`supabase/functions/debrod-veracross-sync`](supabase/functions/debrod-veracross-sync/index.ts)
as an Edge Function named `debrod-veracross-sync`, with **Verify JWT off**
(it checks its own secret, or Huddy's session). With the Supabase CLI:

```sh
supabase functions deploy debrod-veracross-sync --no-verify-jwt
```

Then add its secrets (**Edge Functions → Secrets**, or `supabase secrets set`):

| Secret | Value |
| --- | --- |
| `SYNC_SECRET` | Any long random string (`openssl rand -hex 32`). The schedule sends it. |
| `VERACROSS_MODE` | Leave it unset to run on **made-up data**. Set it to `veracross` once IT has issued the client. |
| `VERACROSS_SCHOOL_ROUTE` | The school's route, as in `https://api.veracross.com/<route>/v3/`. |
| `VERACROSS_CLIENT_ID` | From the OAuth application IT creates. |
| `VERACROSS_CLIENT_SECRET` | From the same application. |

The Veracross secret lives only here. It's never in this repo, in Apps
Script's settings, or in the page.

### 3. The schedule

Turn on the `pg_cron`, `pg_net` and Vault extensions (**Database →
Extensions**), then run this once in the SQL Editor, with your project's URL
and the same `SYNC_SECRET`:

```sql
select vault.create_secret('<the SYNC_SECRET>', 'debrod_hw_sync_secret');

-- 8 and 11 a.m., 2 and 5 p.m. Eastern (12:00 to 21:00 UTC), Monday to Friday.
select cron.schedule('debrod-hw-sync', '0 12,15,18,21 * * 1-5', $$
  select net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/debrod-veracross-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'debrod_hw_sync_secret')),
    body := '{}'::jsonb)
$$);
```

To stop it: `select cron.unschedule('debrod-hw-sync');`.

### 4. The pages

Paste the new `Homework.html` into Apps Script (**+ → HTML**, named
`Homework`), along with the changed `Index`, `Study`, `Games`, `Hub` and
`App`, then deploy a new version. See [SCRIPTS-GUIDE.md](SCRIPTS-GUIDE.md).

### 5. Trying it before IT says yes

With `VERACROSS_MODE` unset, everything runs on made-up classes and
assignments:

1. Sign in as Huddy, open **Study**, and pick **Homework pilot** (or
   **Run the pilot**).
2. Add a member with any number as their Veracross ID.
3. Press **Sync now**. That member now has four classes' worth of
   assignments, some turned in (with coins paid), some late, some missing.
   Work due today flips to turned in after 3 p.m. UTC, so a later sync shows
   coins arriving.
4. Sign in as that member: **Study → Homework** shows the list and the
   balance, and the arcade asks for coins before a game starts.
5. **Delete all pilot data** clears it all before going live.

### 6. Going live

1. Test against the Veracross **sandbox** or a single test student first.
2. The endpoint paths in `PATHS` at the top of
   [`veracross.ts`](supabase/functions/debrod-veracross-sync/veracross.ts)
   follow the scope names. Check each against api-docs.veracross.com in the
   sandbox, and correct them there if the school's API differs. The field
   names it looks for are listed right below them.
3. Set `VERACROSS_MODE` to `veracross` and the three Veracross secrets.
4. Link each student only after their signed opt-in form is in.

### Running the tests

```sh
# The Veracross client and made-up data (Deno or Node 22+):
deno test supabase/functions/debrod-veracross-sync/
node --experimental-strip-types --test supabase/functions/debrod-veracross-sync/veracross.test.ts

# The database rules, on a throwaway local Postgres (PGHOST etc. as usual):
supabase/tests/run.sh
```

## For school IT: security and privacy

Whether to approve the pilot is the school's decision. This section is
here so the setup can be checked against the proposal, line by line.

### Veracross access

- **One OAuth application, client credentials, five read-only scopes:**
  `students:list`, `classes:list`, `academics.enrollments:list`,
  `academics.classes.assignments:list` and
  `academics.assignments.grades:list`. No `:create`, `:update` or
  `:delete` scopes. The scope list is in `SCOPES` in `veracross.ts`, and a
  test checks that every scope requested ends in `:list`.
- **Only GET requests** go to the API; a test checks that too. The only
  POST is the token request to `accounts.veracross.com`.
- **Polite to the API:** requests are paged (100 rows a page), a 429 waits
  for `Retry-After` before trying again, and only assignments due from two
  weeks ago to three weeks ahead are fetched for completion status and kept.
  With no students linked, it makes no calls at all.
- **The secret stays server-side**, as a Supabase Edge Function secret.
  It never appears in the browser, in Apps Script, in this repository or in
  error messages (a test checks a refused token doesn't echo it). IT can
  rotate or revoke the client at any time; the sync then fails safely and
  the app keeps showing the last data it had.

### What's read, and what's kept

- **Grade rows are cut down on arrival.** `academics.assignments.grades:list`
  may return scores. `pickStatus()` copies out only the student ID,
  assignment ID and completion status; scores, letter grades and comments
  are never read into anything that's saved, and there is no column in the
  database to hold them. A test feeds in a row with a score, a letter grade
  and a comment and checks only those three fields come out. If IT can
  offer completion status without scores (a restricted field set or a
  custom query), the change is one function.
- **Only opted-in students.** Some list endpoints may return rows for
  the whole school; the sync filters them to linked students in memory and
  never stores anyone else. A test checks that rows for an unlinked
  student never come out.
- **Stored per student:** Veracross student ID, first name, class names,
  assignment titles and due dates, completion status, and coin history.
  No grades, scores, contact details, photos, attendance or family data.

### Who can see what

Every table has row-level security, checked by
[`supabase/tests/homework.test.sql`](supabase/tests/homework.test.sql):

- **A student** sees only their own assignments, statuses, classes and
  coins. They can't write to any of them: coins are paid only by the
  database's own `debrod_hw_award()`, which only the sync can call, and
  spending goes through `debrod_hw_spend()`, which checks the balance and
  the daily limit in the database. A student can't mark work turned in or
  give themselves coins.
- **Huddy (the admin, who runs the pilot)** sees the roster (each
  student's name, Veracross ID and coin balance) and the sync log, and can
  change the coin amounts. Huddy **can't** see students' assignments or
  statuses.
- **Anyone else on DEBROD** sees nothing from the pilot. Signed-out
  visitors see nothing at all.
- The service role key (used only by the Edge Function) is the one thing
  that can write synced data.

### Opting out and the end of the pilot

- A student can leave from **Study → Homework → Leave the pilot**, or
  Huddy can remove them. Either deletes their link, synced assignments and
  coins **immediately**, well inside the proposal's 7 days. Deleting their
  DEBROD account does the same.
- **Delete all pilot data** on Huddy's page deletes every link, assignment,
  class, coin and sync log entry. After that, remove the Veracross secrets
  and ask IT to revoke the client.

### Limits worth knowing

- **The arcade lock is a convenience, not a security boundary.** It runs
  in the student's browser, so a determined student could get round it to
  play without spending coins. What can't be faked is the coins and the
  homework data, which only the database and the sync can change.
- **Endpoint paths need confirming in the sandbox** (see Going live). The
  client reads a short, fixed list of field names, so a mismatch shows up
  as a failed or empty sync in the sync log, not as extra data.
- **Where it runs:** inside DEBROD, a student-made site on Google Apps
  Script with a Supabase database. The pilot's tables are separate from
  the rest of DEBROD and are covered by their own file, so they can be
  reviewed, or moved to a separate project, on their own.
- **No sharing:** no third parties, ads or tracking. The sync log records
  every run (when, how many students and assignments, how many payments,
  and any error) for Huddy and IT to read.
