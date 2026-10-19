// Bundles Showdown's simulator for the browser. Learnsets and legality only
// matter for checking hand-built teams, so random battles don't need them.
import * as esbuild from 'esbuild'

const stubs = {
  'learnsets.mjs': 'export const Learnsets = {}',
  'legality.mjs': 'export const Legality = {}',
  'pokemongo.mjs': 'export const PokemonGoData = {}',
}

await esbuild.build({
  entryPoints: ['src/entry.js'],
  bundle: true,
  minify: process.env.MIN !== '0',
  format: 'iife',
  globalName: 'PkmnShowdown',
  platform: 'browser',
  target: 'es2019',
  legalComments: 'eof',
  // The simulator reaches for Node's `global` in a few places.
  define: { global: 'globalThis' },
  outfile: process.argv[2] || 'showdown.js',
  plugins: [{
    name: 'stub-unneeded-data',
    setup(build) {
      build.onLoad({ filter: /@pkmn[\\/]sim[\\/].*[\\/](learnsets|legality|pokemongo)\.mjs$/ }, args => ({
        contents: stubs[args.path.split(/[\\/]/).pop()],
        loader: 'js',
      }))
    },
  }],
})
