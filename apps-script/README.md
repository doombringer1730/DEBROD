# Homework Arcade (Google Apps Script)

Students earn coins for turning in missing and due assignments and spend them
on arcade games. Until the Veracross keys work, it runs in practice mode with
placeholder assignments.

Files to copy into the Apps Script project:

- `Code.gs`: the server side (coins, assignments, game plays)
- `Index.html`: the page and the games
- `veracross.gs` stays as it is in the project

Deploy with **Deploy → New deployment → Web app**, executing as yourself, with
access limited to people at the school so each student's Google account
identifies them.

Set the script property `USE_VERACROSS` to `true` once real assignments are
wired up in `veracrossAssignments_`.
