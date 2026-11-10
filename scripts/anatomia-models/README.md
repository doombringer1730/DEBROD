# Anatomía models

- `mapping.py` — which structure each clue item lights up.
- `transforms.json` — how each model maps BodyParts3D millimetres to model space
  (`(x, z, -y)`, centred, scaled), recovered from the existing meshes.
- `build.py` — appends the structures in `mapping.py` to `public/anatomia/*.glb`
  from the BodyParts3D 4.0 download (instructions in its header). Existing meshes are kept as is.
- `render.html` + `cards.cjs` — render the unit card images. Serve a folder holding
  `render.html` as `index.html`, `three` (→ `node_modules/three`) and `models`
  (→ `public/anatomia`) on port 8765, run `node cards.cjs <out dir>`, then convert
  the PNGs to WebP in `public/anatomia/cards/`.

- `plates.cjs` — renders the locator images for plates (e.g. the kidneys and adrenals
  for the adrenal plate) the same way; `render.html` takes `only=` to keep just some meshes.

After any change run `npm run check:anatomia`.
