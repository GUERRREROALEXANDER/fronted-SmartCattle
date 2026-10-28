// Synthetic pasture clip for evaluators without footage. Colors here are pixels of the generated
// video (grass, hides, clothes), not UI colors, so they do not come from the design tokens.

export const SYNTHETIC_DURATION_SEC = 12
export const SYNTHETIC_WIDTH = 640
export const SYNTHETIC_HEIGHT = 360
export const SYNTHETIC_FILE_NAME = 'video-ejemplo-potrero.webm'

interface Waypoint { t: number; x: number; y: number }

interface Actor {
  kind: 'cow' | 'person'
  path: Waypoint[]
  size: number
  hide?: 'holstein' | 'brown' | 'black'
}

// Lanes keep actors apart so the motion detector sees them separately. The black cow leaves the
// default safe zone (x > 0.9) between ~4.5 s and ~9 s; the person enters from the left edge.
export const SYNTHETIC_ACTORS: Actor[] = [
  { kind: 'cow', hide: 'holstein', size: 0.95, path: [{ t: 0, x: 0.16, y: 0.28 }, { t: 6, x: 0.4, y: 0.3 }, { t: 12, x: 0.2, y: 0.28 }] },
  { kind: 'cow', hide: 'brown', size: 1, path: [{ t: 0, x: 0.8, y: 0.3 }, { t: 6, x: 0.58, y: 0.28 }, { t: 12, x: 0.76, y: 0.3 }] },
  { kind: 'cow', hide: 'black', size: 0.95, path: [{ t: 0, x: 0.6, y: 0.72 }, { t: 4.5, x: 0.9, y: 0.74 }, { t: 7, x: 0.945, y: 0.76 }, { t: 9.5, x: 0.88, y: 0.74 }, { t: 12, x: 0.64, y: 0.72 }] },
  { kind: 'cow', hide: 'holstein', size: 0.9, path: [{ t: 0, x: 0.14, y: 0.74 }, { t: 6, x: 0.38, y: 0.75 }, { t: 12, x: 0.18, y: 0.74 }] },
  { kind: 'person', size: 0.8, path: [{ t: 0, x: 0.05, y: 0.54 }, { t: 12, x: 0.52, y: 0.54 }] },
]

export function actorPosition(path: readonly Waypoint[], timeSec: number): { x: number; y: number; dx: number } {
  const first = path[0]
  if (timeSec <= first.t) return { x: first.x, y: first.y, dx: 0 }
  for (let index = 1; index < path.length; index++) {
    const from = path[index - 1]
    const to = path[index]
    if (timeSec <= to.t) {
      const progress = (timeSec - from.t) / Math.max(to.t - from.t, 0.001)
      return { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress, dx: Math.sign(to.x - from.x) }
    }
  }
  const last = path[path.length - 1]
  return { x: last.x, y: last.y, dx: 0 }
}

const HIDES = {
  holstein: { body: '#F4F1EA', patch: '#1B1B1B', head: '#F4F1EA' },
  brown: { body: '#8A4B24', patch: '#5E2F14', head: '#7A3F1C' },
  black: { body: '#222222', patch: '#3A3A3A', head: '#1A1A1A' },
}

// Static grass tufts from a fixed seed so the background never "moves".
const TUFTS = Array.from({ length: 140 }, (_, index) => {
  const a = Math.sin(index * 12.9898) * 43758.5453
  const b = Math.sin(index * 78.233) * 12345.678
  return { x: a - Math.floor(a), y: 0.18 + (b - Math.floor(b)) * 0.82 }
})

function drawField(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.18)
  sky.addColorStop(0, '#BFE6FF')
  sky.addColorStop(1, '#E3F4FF')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h * 0.18)
  const grass = ctx.createLinearGradient(0, h * 0.18, 0, h)
  grass.addColorStop(0, '#7CC46A')
  grass.addColorStop(1, '#4E9E47')
  ctx.fillStyle = grass
  ctx.fillRect(0, h * 0.18, w, h * 0.82)
  ctx.strokeStyle = '#8C6B45'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, h * 0.2)
  ctx.lineTo(w, h * 0.2)
  ctx.stroke()
  for (let post = 0; post <= 16; post++) {
    ctx.fillStyle = '#7A5A38'
    ctx.fillRect((post / 16) * w - 2, h * 0.15, 4, h * 0.08)
  }
  ctx.fillStyle = '#5FAE52'
  for (const tuft of TUFTS) ctx.fillRect(tuft.x * w, tuft.y * h, 3, 2)
}

function drawCow(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, facing: number, timeSec: number, hide: keyof typeof HIDES, moving: boolean) {
  const colors = HIDES[hide]
  const bodyW = 66 * scale
  const bodyH = 30 * scale
  const legH = 16 * scale
  const dir = facing < 0 ? -1 : 1
  const swing = moving ? Math.sin(timeSec * 9) * 4 * scale : 0

  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.beginPath()
  ctx.ellipse(x, y + bodyH / 2 + legH, bodyW * 0.55, 5 * scale, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = colors.head
  ctx.lineWidth = 6 * scale
  ctx.lineCap = 'round'
  const legs = [-0.34, -0.18, 0.18, 0.34]
  legs.forEach((offset, index) => {
    const legX = x + offset * bodyW
    const phase = index % 2 === 0 ? swing : -swing
    ctx.beginPath()
    ctx.moveTo(legX, y + bodyH * 0.3)
    ctx.lineTo(legX + phase, y + bodyH / 2 + legH)
    ctx.stroke()
  })

  ctx.fillStyle = colors.body
  ctx.beginPath()
  ctx.ellipse(x, y, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = colors.patch
  ctx.beginPath()
  ctx.ellipse(x - bodyW * 0.12, y - bodyH * 0.1, bodyW * 0.16, bodyH * 0.28, 0.4, 0, Math.PI * 2)
  ctx.ellipse(x + bodyW * 0.2, y + bodyH * 0.05, bodyW * 0.1, bodyH * 0.22, -0.3, 0, Math.PI * 2)
  ctx.fill()

  const headX = x + dir * bodyW * 0.55
  const headY = y - bodyH * 0.15 + (moving ? 0 : Math.sin(timeSec * 2) * 3 * scale)
  ctx.fillStyle = colors.head
  ctx.beginPath()
  ctx.ellipse(headX, headY, 13 * scale, 10 * scale, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#E8A0A0'
  ctx.beginPath()
  ctx.ellipse(headX + dir * 8 * scale, headY + 3 * scale, 6 * scale, 5 * scale, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawPerson(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, timeSec: number) {
  const swing = Math.sin(timeSec * 7) * 6 * scale
  const hip = y + 4 * scale
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.beginPath()
  ctx.ellipse(x, hip + 34 * scale, 12 * scale, 4 * scale, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#1F2A44'
  ctx.lineWidth = 7 * scale
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x, hip)
  ctx.lineTo(x + swing, hip + 32 * scale)
  ctx.moveTo(x, hip)
  ctx.lineTo(x - swing, hip + 32 * scale)
  ctx.stroke()
  ctx.fillStyle = '#1E4FA0'
  ctx.fillRect(x - 9 * scale, y - 30 * scale, 18 * scale, 36 * scale)
  ctx.strokeStyle = '#1E4FA0'
  ctx.lineWidth = 5 * scale
  ctx.beginPath()
  ctx.moveTo(x - 8 * scale, y - 26 * scale)
  ctx.lineTo(x - 10 * scale - swing * 0.5, y)
  ctx.moveTo(x + 8 * scale, y - 26 * scale)
  ctx.lineTo(x + 10 * scale + swing * 0.5, y)
  ctx.stroke()
  ctx.fillStyle = '#C68B59'
  ctx.beginPath()
  ctx.arc(x, y - 40 * scale, 9 * scale, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#F2C94C'
  ctx.fillRect(x - 13 * scale, y - 50 * scale, 26 * scale, 5 * scale)
}

export function drawSyntheticFrame(ctx: CanvasRenderingContext2D, timeSec: number, width = SYNTHETIC_WIDTH, height = SYNTHETIC_HEIGHT) {
  drawField(ctx, width, height)
  const ordered = SYNTHETIC_ACTORS
    .map(actor => ({ actor, position: actorPosition(actor.path, timeSec), ahead: actorPosition(actor.path, timeSec + 0.1) }))
    .sort((first, second) => first.position.y - second.position.y)
  const scale = width / SYNTHETIC_WIDTH
  for (const { actor, position, ahead } of ordered) {
    const x = position.x * width
    const y = position.y * height
    const perspective = (0.75 + position.y * 0.5) * actor.size * scale
    if (actor.kind === 'person') drawPerson(ctx, x, y, perspective, timeSec)
    else {
      const moving = Math.abs(ahead.x - position.x) + Math.abs(ahead.y - position.y) > 0.0005
      drawCow(ctx, x, y, perspective, ahead.x - position.x || position.dx || 1, timeSec, actor.hide ?? 'holstein', moving)
    }
  }
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type))
}

export function canRecordSyntheticVideo(): boolean {
  return typeof document !== 'undefined'
    && typeof MediaRecorder !== 'undefined'
    && typeof HTMLCanvasElement !== 'undefined'
    && 'captureStream' in HTMLCanvasElement.prototype
}

export interface RecordOptions {
  durationSec?: number
  onProgress?: (ratio: number) => void
  signal?: AbortSignal
}

/** Renders the scene in real time into a canvas and records it with MediaRecorder. */
export function recordSyntheticVideo({ durationSec = SYNTHETIC_DURATION_SEC, onProgress, signal }: RecordOptions = {}): Promise<File> {
  return new Promise((resolve, reject) => {
    if (!canRecordSyntheticVideo()) {
      reject(new Error('Este navegador no puede grabar el video de ejemplo.'))
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = SYNTHETIC_WIDTH
    canvas.height = SYNTHETIC_HEIGHT
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('Este navegador no ofrece un lienzo 2D para el video de ejemplo.'))
      return
    }
    drawSyntheticFrame(ctx, 0)
    const stream = canvas.captureStream(30)
    const mimeType = pickMimeType()
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 })
    const chunks: Blob[] = []
    let aborted = false

    const stopTracks = () => stream.getTracks().forEach(track => track.stop())
    const onAbort = () => {
      aborted = true
      clearInterval(timer)
      if (recorder.state !== 'inactive') recorder.stop()
      stopTracks()
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })

    recorder.ondataavailable = event => { if (event.data.size > 0) chunks.push(event.data) }
    recorder.onerror = () => {
      clearInterval(timer)
      stopTracks()
      reject(new Error('No se pudo grabar el video de ejemplo.'))
    }
    recorder.onstop = () => {
      signal?.removeEventListener('abort', onAbort)
      stopTracks()
      if (aborted) return
      const type = mimeType?.split(';')[0] ?? 'video/webm'
      resolve(new File(chunks, SYNTHETIC_FILE_NAME, { type }))
    }

    recorder.start(250)
    const startedAt = performance.now()
    // setInterval keeps the clock running even if the tab loses rAF priority.
    const timer = setInterval(() => {
      const elapsed = (performance.now() - startedAt) / 1000
      drawSyntheticFrame(ctx, Math.min(elapsed, durationSec))
      onProgress?.(Math.min(1, elapsed / durationSec))
      if (elapsed >= durationSec) {
        clearInterval(timer)
        recorder.stop()
      }
    }, 1000 / 30)
  })
}
