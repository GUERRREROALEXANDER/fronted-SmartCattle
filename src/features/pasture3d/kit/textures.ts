import { CanvasTexture, NoColorSpace, RepeatWrapping, SRGBColorSpace } from 'three'
import { mulberry32 } from '../simulation/rng'

type Draw = (g: CanvasRenderingContext2D, size: number, rng: () => number) => void

const cache = new Map<string, CanvasTexture>()

function canvasTexture(key: string, width: number, height: number, draw: Draw, color = true) {
  const cached = cache.get(key)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const g = canvas.getContext('2d')
  if (!g) throw new Error('2D canvas unavailable')
  draw(g, width, mulberry32(key.length * 7919 + key.charCodeAt(0)))
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = color ? SRGBColorSpace : NoColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.anisotropy = 8
  cache.set(key, texture)
  return texture
}

const rgba = (r: number, g: number, b: number, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`

/** Weathered timber: long grain along V, knots, a grey sun-bleached cast. */
export function woodTexture() {
  return canvasTexture('wood', 128, 512, (g, s, r) => {
    g.fillStyle = '#8a7660'
    g.fillRect(0, 0, s, 512)
    for (let i = 0; i < 260; i += 1) {
      const x = r() * s
      const l = 70 + r() * 90
      g.strokeStyle = rgba(l * 1.05, l * 0.88, l * 0.7, 0.18 + r() * 0.3)
      g.lineWidth = 0.6 + r() * 2.2
      g.beginPath()
      g.moveTo(x, 0)
      for (let y = 0; y <= 512; y += 32) g.lineTo(x + Math.sin(y * 0.02 + x) * 2.5, y)
      g.stroke()
    }
    for (let k = 0; k < 4; k += 1) {
      const x = r() * s
      const y = r() * 512
      g.fillStyle = rgba(55, 40, 28, 0.55)
      g.beginPath()
      g.ellipse(x, y, 3 + r() * 4, 7 + r() * 8, 0, 0, Math.PI * 2)
      g.fill()
    }
    g.fillStyle = rgba(170, 170, 160, 0.12)
    g.fillRect(0, 0, s, 512)
  })
}

/** Painted barn siding: vertical boards with dark gaps and flaking paint. */
export function plankTexture() {
  return canvasTexture('planks', 512, 512, (g, s, r) => {
    const boards = 8
    const w = s / boards
    for (let b = 0; b < boards; b += 1) {
      const tone = 0.85 + r() * 0.25
      g.fillStyle = rgba(128 * tone, 46 * tone, 34 * tone)
      g.fillRect(b * w, 0, w, s)
      for (let i = 0; i < 40; i += 1) {
        const x = b * w + r() * w
        g.strokeStyle = rgba(70, 30, 22, 0.12 + r() * 0.2)
        g.lineWidth = 0.6 + r() * 1.5
        g.beginPath()
        g.moveTo(x, 0)
        g.lineTo(x + (r() - 0.5) * 3, s)
        g.stroke()
      }
      for (let i = 0; i < 22; i += 1) {
        g.fillStyle = rgba(150, 128, 104, 0.35 + r() * 0.3)
        g.fillRect(b * w + r() * w, r() * s, 2 + r() * 10, 1 + r() * 3)
      }
      g.fillStyle = rgba(30, 14, 10, 0.9)
      g.fillRect(b * w, 0, 2.5, s)
    }
  })
}

/** Galvanised corrugated sheet ("teja de zinc") with rust streaks. */
export function corrugatedTexture() {
  return canvasTexture('zinc', 256, 256, (g, s, r) => {
    for (let x = 0; x < s; x += 1) {
      const l = 150 + Math.sin((x / s) * Math.PI * 2 * 8) * 45
      g.fillStyle = rgba(l * 0.96, l, l * 1.02)
      g.fillRect(x, 0, 1, s)
    }
    for (let i = 0; i < 40; i += 1) {
      const x = r() * s
      const y = r() * s
      const grad = g.createLinearGradient(x, y, x, y + 40 + r() * 60)
      grad.addColorStop(0, rgba(120, 66, 32, 0.45))
      grad.addColorStop(1, rgba(120, 66, 32, 0))
      g.fillStyle = grad
      g.fillRect(x, y, 2 + r() * 5, 100)
    }
  })
}

export function denimTexture() {
  return canvasTexture('denim', 256, 256, (g, s, r) => {
    g.fillStyle = '#34507a'
    g.fillRect(0, 0, s, s)
    for (let i = -s; i < s * 2; i += 3) {
      g.strokeStyle = rgba(200, 210, 230, 0.12 + r() * 0.08)
      g.lineWidth = 1
      g.beginPath()
      g.moveTo(i, 0)
      g.lineTo(i + s, s)
      g.stroke()
    }
    for (let i = 0; i < 1800; i += 1) {
      g.fillStyle = rgba(r() < 0.5 ? 20 : 170, r() < 0.5 ? 34 : 185, r() < 0.5 ? 60 : 215, 0.12)
      g.fillRect(r() * s, r() * s, 2, 1)
    }
  })
}

export function plaidTexture(key: string, base: string, stripeA: string, stripeB: string) {
  return canvasTexture(`plaid-${key}`, 256, 256, (g, s, r) => {
    g.fillStyle = base
    g.fillRect(0, 0, s, s)
    g.globalAlpha = 0.55
    for (let k = 0; k < 4; k += 1) {
      g.fillStyle = stripeA
      g.fillRect(k * 64 + 8, 0, 22, s)
      g.fillRect(0, k * 64 + 8, s, 22)
      g.fillStyle = stripeB
      g.fillRect(k * 64 + 44, 0, 4, s)
      g.fillRect(0, k * 64 + 44, s, 4)
    }
    g.globalAlpha = 1
    for (let i = 0; i < 2500; i += 1) {
      g.fillStyle = rgba(255, 255, 255, 0.05 * r())
      g.fillRect(r() * s, r() * s, 1, 1)
    }
  })
}

export function clothTexture(key: string, base: string) {
  return canvasTexture(`cloth-${key}`, 128, 128, (g, s, r) => {
    g.fillStyle = base
    g.fillRect(0, 0, s, s)
    for (let i = 0; i < 2400; i += 1) {
      g.fillStyle = r() < 0.5 ? rgba(0, 0, 0, 0.06) : rgba(255, 255, 255, 0.06)
      g.fillRect(r() * s, r() * s, 1 + r() * 2, 1)
    }
  })
}

/** Woven straw for the aguadeño hat. */
export function strawTexture() {
  return canvasTexture('straw', 128, 128, (g, s, r) => {
    g.fillStyle = '#d8c48e'
    g.fillRect(0, 0, s, s)
    for (let y = 0; y < s; y += 4) {
      for (let x = 0; x < s; x += 4) {
        const odd = ((x + y) / 4) % 2 === 0
        const l = 190 + r() * 45
        g.fillStyle = rgba(l, l * 0.86, l * 0.58, 0.9)
        if (odd) g.fillRect(x, y, 4, 3)
        else g.fillRect(x, y, 3, 4)
      }
    }
  })
}

export function leatherTexture() {
  return canvasTexture('leather', 128, 128, (g, s, r) => {
    g.fillStyle = '#5b3a22'
    g.fillRect(0, 0, s, s)
    for (let i = 0; i < 900; i += 1) {
      g.fillStyle = rgba(r() < 0.5 ? 30 : 120, r() < 0.5 ? 18 : 80, 10, 0.12)
      g.beginPath()
      g.arc(r() * s, r() * s, 1 + r() * 3, 0, Math.PI * 2)
      g.fill()
    }
  })
}

/** Farm road: two wheel ruts, a grass strip between them, feathered grassy edges (alpha). */
export function roadTexture() {
  return canvasTexture('road', 256, 256, (g, s, r) => {
    const image = g.createImageData(s, s)
    for (let y = 0; y < s; y += 1) {
      for (let x = 0; x < s; x += 1) {
        const v = x / s
        const n = r()
        const rut = Math.exp(-((v - 0.28) ** 2) / 0.004) + Math.exp(-((v - 0.72) ** 2) / 0.004)
        const middle = Math.exp(-((v - 0.5) ** 2) / 0.003)
        let red = 132 - rut * 22 + n * 26
        let green = 106 - rut * 18 + n * 20
        let blue = 74 - rut * 12 + n * 14
        if (r() < middle * 0.75) {
          red = 92 + n * 30
          green = 118 + n * 34
          blue = 52
        }
        const edge = Math.min(v, 1 - v)
        const alpha = Math.min(1, Math.max(0, (edge - 0.02 - r() * 0.07) / 0.1))
        const index = (y * s + x) * 4
        image.data[index] = red
        image.data[index + 1] = green
        image.data[index + 2] = blue
        image.data[index + 3] = alpha * 255
      }
    }
    g.putImageData(image, 0, 0)
    for (let i = 0; i < 260; i += 1) {
      const l = 90 + r() * 90
      g.fillStyle = rgba(l, l * 0.92, l * 0.8, 0.85)
      g.beginPath()
      g.arc(s * (0.12 + r() * 0.76), r() * s, 0.6 + r() * 1.8, 0, Math.PI * 2)
      g.fill()
    }
  })
}

/** Fine turf detail, multiplied over the ground's vertex colours. */
export function turfTexture() {
  return canvasTexture('turf', 512, 512, (g, s, r) => {
    g.fillStyle = '#cfd6c4'
    g.fillRect(0, 0, s, s)
    for (let i = 0; i < 11000; i += 1) {
      const x = r() * s
      const y = r() * s
      const l = 140 + r() * 115
      g.strokeStyle = rgba(l * 0.85, l, l * 0.68, 0.25 + r() * 0.35)
      g.lineWidth = 1 + r() * 1.5
      const angle = r() * Math.PI * 2
      const length = 3 + r() * 7
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length)
      g.stroke()
    }
    for (let i = 0; i < 700; i += 1) {
      g.fillStyle = rgba(110, 90, 60, 0.15 + r() * 0.2)
      g.fillRect(r() * s, r() * s, 1.5 + r() * 2, 1.5 + r() * 2)
    }
  })
}

/** A leafy cluster on transparent ground, used on crossed foliage cards. */
export function leafTexture() {
  return canvasTexture('leaves', 256, 256, (g, s, r) => {
    g.clearRect(0, 0, s, s)
    for (let i = 0; i < 260; i += 1) {
      const angle = r() * Math.PI * 2
      const radius = Math.sqrt(r()) * s * 0.42
      const x = s / 2 + Math.cos(angle) * radius
      const y = s / 2 + Math.sin(angle) * radius
      const l = 0.55 + r() * 0.6
      g.fillStyle = rgba(150 * l, 190 * l, 110 * l)
      g.save()
      g.translate(x, y)
      g.rotate(r() * Math.PI)
      g.beginPath()
      g.ellipse(0, 0, 4 + r() * 4, 9 + r() * 7, 0, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = rgba(60, 80, 40, 0.35)
      g.lineWidth = 0.8
      g.stroke()
      g.restore()
    }
  })
}

export function barkTexture() {
  return canvasTexture('bark', 128, 256, (g, s, r) => {
    g.fillStyle = '#5a4838'
    g.fillRect(0, 0, s, 256)
    for (let i = 0; i < 180; i += 1) {
      const x = r() * s
      g.strokeStyle = r() < 0.5 ? rgba(35, 26, 20, 0.6) : rgba(130, 118, 100, 0.35)
      g.lineWidth = 1 + r() * 3
      g.beginPath()
      g.moveTo(x, r() * 256)
      g.lineTo(x + (r() - 0.5) * 6, r() * 256)
      g.stroke()
    }
  })
}

export function concreteTexture() {
  return canvasTexture('concrete', 128, 128, (g, s, r) => {
    g.fillStyle = '#9b9890'
    g.fillRect(0, 0, s, s)
    for (let i = 0; i < 1600; i += 1) {
      const l = 110 + r() * 80
      g.fillStyle = rgba(l, l * 0.98, l * 0.92, 0.25)
      g.fillRect(r() * s, r() * s, 1 + r() * 2, 1 + r() * 2)
    }
  })
}

/** Painted sign board with a carved-looking name. */
export function signTexture(text: string) {
  return canvasTexture(`sign-${text}`, 512, 192, (g, _s, r) => {
    g.fillStyle = '#6e5238'
    g.fillRect(0, 0, 512, 192)
    for (let i = 0; i < 120; i += 1) {
      const y = r() * 192
      g.strokeStyle = rgba(40, 28, 18, 0.25)
      g.lineWidth = 1 + r() * 2
      g.beginPath()
      g.moveTo(0, y)
      g.lineTo(512, y + (r() - 0.5) * 6)
      g.stroke()
    }
    g.strokeStyle = '#f1e9d6'
    g.lineWidth = 8
    g.strokeRect(14, 14, 484, 164)
    g.fillStyle = '#f4ecd8'
    g.font = 'bold 92px Archivo, Arial, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(text, 256, 100)
  })
}

/** Rolled hay: short straw strokes, mostly along the roll. */
export function baleTexture() {
  return canvasTexture('bale', 256, 256, (g, s, r) => {
    g.fillStyle = '#c4a14e'
    g.fillRect(0, 0, s, s)
    for (let i = 0; i < 2600; i += 1) {
      const x = r() * s
      const y = r() * s
      const l = 120 + r() * 125
      g.strokeStyle = rgba(l, l * 0.82, l * 0.42, 0.6)
      g.lineWidth = 1 + r() * 1.4
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + 6 + r() * 14, y + (r() - 0.5) * 4)
      g.stroke()
    }
  })
}
