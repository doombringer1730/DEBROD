# Pokémon Showdown for the arcade

[play.pokemonshowdown.com](https://play.pokemonshowdown.com) won't run inside
other sites, so the arcade runs **Showdown's own battle simulator** in the
page instead: the same engine, rules and random teams, through the
[@pkmn](https://github.com/pkmn/ps) packages that wrap it for browsers.
Sprites come from Showdown's sprite server.

| File | What it is |
| --- | --- |
| `showdown.js` | The bundle (global `PkmnShowdown`), about 800 KB compressed. |
| `src/entry.js` | What goes into it: the simulator, random teams, and the client-side battle tracker and log formatter. |
| `build.mjs` | The esbuild script. It leaves out learnsets and legality data, which only matter for checking hand-built teams. |
| `package.json` | The pinned versions. |
| `LICENSE` | The bundled packages' licenses (all MIT). |

`Showdown.html` loads `showdown.js` from jsDelivr, pinned to the commit that
added it, the same way Doom loads.

## Rebuild

```bash
npm install
npm run build
```

Then commit `showdown.js` and update the commit in `SHOWDOWN_BASE` at the top of `Showdown.html`.
