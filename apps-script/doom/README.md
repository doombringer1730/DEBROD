# Doom for the arcade

The arcade's Doom is [DoomPDF](https://github.com/ading2210/doompdf)'s engine,
taken out of the PDF and drawn on a `<canvas>` instead of rows of text
fields. DoomPDF is a fork of [doomgeneric](https://github.com/ozkl/doomgeneric).

| File | What it is |
| --- | --- |
| `doomgeneric_web.c` | The browser frontend: frames out, keys in. It replaces DoomPDF's `doomgeneric_pdfjs.c`. |
| `build.sh` | Fetches DoomPDF at a pinned commit, applies one fix, and compiles it to `doom.js` with Emscripten. |
| `doom.js` | The built engine (WebAssembly, inlined into the JS). |
| `doom1.wad` | The shareware Doom 1.9 IWAD (episode one, *Knee-Deep in the Dead*). |
| `LICENSE` | DoomPDF's license, the GNU GPL v2. |

`Games.html` loads `doom.js` and `doom1.wad` from jsDelivr, pinned to the
commit that added them. They aren't pasted into Apps Script, so the
script project stays small. jsDelivr only serves public repositories, so if
this repo goes private, Doom stops loading.

## The fix

DoomPDF's screen wipe takes a frame with no new game tic as the end of the
melt. The PDF drew so slowly (about 80 ms a frame) that this never came up.
At 60 fps it left a strip of the old screen at the bottom of the status bar,
so `build.sh` patches `d_main.c` to skip those frames.

## Rebuild

With [Emscripten](https://emscripten.org) on the PATH (tested with 3.1.74):

```bash
./build.sh
```

## License

Doom's engine code here is GPL v2 (see `LICENSE`), unlike the rest of this
repository. `doom1.wad` is id Software's shareware release, which may be
shared unmodified.
