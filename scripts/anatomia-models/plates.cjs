const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
  const p = await b.newPage({ viewport: { width: 1000, height: 800 } })
  for (const [spin, tilt, name] of [['0', '0.1', 'a'], ['-0.3', '0.15', 'b'], ['0.5', '0.25', 'c']]) {
    await p.goto(`http://localhost:8765/index.html?model=abdomen&mesh=suprarrenal&w=800&h=500&fit=0.8&spin=${spin}&tilt=${tilt}&ghost=0.35&only=suprarrenal,rinon,aorta_abdominal,cava_inferior`)
    await p.waitForFunction(() => document.title === 'done')
    await p.locator('canvas').screenshot({ path: `loc-${name}.png`, omitBackground: true })
  }
  await b.close()
})()
