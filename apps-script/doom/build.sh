#!/bin/bash
# Builds doom.js: DoomPDF's doomgeneric (pinned below) compiled to
# WebAssembly with doomgeneric_web.c as its frontend. Needs Emscripten
# (emcc) on the PATH; tested with 3.1.74.
#
#   ./build.sh            # writes doom.js next to this script
#
# doom1.wad is the shareware Doom 1.9 IWAD, which id Software allows to be
# shared unmodified. sha1 5b2e249b9c5133ec987b3ea77596381dc0d6bc1d.

set -euo pipefail

DOOMPDF_COMMIT=7f6e354e007ed8ea5921e6e9f440a06d8189676b
here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

git clone --quiet https://github.com/ading2210/doompdf "$work/doompdf"
git -C "$work/doompdf" checkout --quiet "$DOOMPDF_COMMIT"
src="$work/doompdf/doomgeneric"
cp "$here/doomgeneric_web.c" "$src/"

# DoomPDF's screen wipe treats a frame with no new tic as the end of the
# melt. The PDF drew too slowly to notice; at 60 fps it leaves a strip of
# the old screen behind, so skip those frames instead.
sed -i 's|^    int tics = nowtime - wipestart;$|&\n    if (tics <= 0) return;|' "$src/d_main.c"
grep -q 'if (tics <= 0) return;' "$src/d_main.c" || { echo "wipe patch did not apply" >&2; exit 1; }

# Everything the PDF build compiles, with our frontend in place of the PDF one.
objs=$(sed -n 's/^SRC_DOOM = //p' "$src/Makefile.pdfjs" | sed 's/doomgeneric_pdfjs\.o/doomgeneric_web.o/')
files=$(for o in $objs; do echo "$src/${o%.o}.c"; done)

emcc -O3 -Wno-everything $files -o "$here/doom.js" \
  -sMODULARIZE=1 -sEXPORT_NAME=createDoom \
  -sSINGLE_FILE=1 -sENVIRONMENT=web \
  -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=33554432 \
  -sFORCE_FILESYSTEM=1 -sEXPORTED_RUNTIME_METHODS=FS,HEAPU8 \
  -sEXIT_RUNTIME=0 -lm

echo "Wrote $here/doom.js ($(du -h "$here/doom.js" | cut -f1))"
