const { chromium } = require('playwright')
const cards = {
  fundamentos: 'pie:calcaneo:-0.9', craneo: 'skull:esfenoides:-0.7', snc: 'encefalo:cerebelo:-1.1', pares: 'encefalo:nervio_optico:-0.5',
  ojo: 'ojo:iris:-0.5', oido: 'skull:oreja:-1.2', cara: 'skull:maxilar:-0.4', cuello: 'cuello:cartilago_tiroides:-0.6',
  snp: 'columna:lumbares:-1.2', torax: 'torax:corazon:-0.3', abdomen: 'abdomen:estomago:-0.3', pelvis: 'pelvis:coxal:-0.5',
  'miembro-superior': 'msup:humero:-0.3', 'miembro-inferior': 'minf:femur:-0.4',
}
;(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
  const p = await b.newPage({ viewport: { width: 800, height: 600 } })
  for (const [slug, spec] of Object.entries(cards)) {
    const [model, mesh, spin] = spec.split(':')
    await p.goto(`http://localhost:8765/index.html?model=${model}&mesh=${mesh}&w=480&h=300&fit=0.82&spin=${spin}&ghost=0.3`)
    await p.waitForFunction(() => document.title === 'done', null, { timeout: 60000 })
    await p.locator('canvas').screenshot({ path: `${process.argv[2]}/${slug}.png`, omitBackground: true })
  }
  await b.close()
})()
