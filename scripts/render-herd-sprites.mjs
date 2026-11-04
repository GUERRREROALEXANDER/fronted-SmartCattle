// Renders the printed herd's sprite sheet from the approved 3D cow.
// Usage: start `npm run dev`, then: node scripts/render-herd-sprites.mjs <playwright-core dir> <base url>
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [toolDir, baseUrl = 'http://localhost:5173'] = process.argv.slice(2)
const { chromium } = createRequire(resolve(toolDir, 'index.js'))('playwright-core')

const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 400, height: 300 } })
page.on('pageerror', error => console.error(error.message))
await page.goto(`${baseUrl}/dev/sprite-rig`)
await page.waitForFunction(() => '__captureHerd' in window, null, { timeout: 60_000 })
const dataUrl = await page.evaluate(() => window.__captureHerd())
mkdirSync('src/assets/herd', { recursive: true })
writeFileSync('src/assets/herd/cow-sheet.png', Buffer.from(dataUrl.split(',')[1], 'base64'))
await browser.close()
console.log('wrote src/assets/herd/cow-sheet.png')
