// Renders the placeholder app icon: an "M" in Cormorant Garamond on #f3f2f2.
// Uses Playwright's Chromium. Run: npm run gen:icons
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const font = readFileSync(new URL('../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-normal.woff2', import.meta.url))
const fontUrl = `data:font/woff2;base64,${font.toString('base64')}`

const html = (size) => `<!doctype html><style>
@font-face { font-family: C; src: url(${fontUrl}) format('woff2'); }
html, body { margin: 0; }
div { width: ${size}px; height: ${size}px; background: #f3f2f2; color: #201f1d; display: grid; place-items: center;
  font: 400 ${Math.round(size * 0.7)}px/1 C; padding-bottom: ${Math.round(size * 0.04)}px; box-sizing: border-box; }
</style><div>M</div>`

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const page = await browser.newPage()
for (const [size, name] of [[180, 'apple-touch-icon.png'], [192, 'icon-192.png'], [512, 'icon-512.png']]) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(html(size))
  await page.evaluate(() => document.fonts.ready)
  writeFileSync(new URL(`../public/${name}`, import.meta.url), await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size } }))
  console.log('wrote', name)
}
await browser.close()
