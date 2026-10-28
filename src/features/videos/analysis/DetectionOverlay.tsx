import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import { useReducedMotion } from 'motion/react'
import type { Box, Detection, FrameResult, Point } from '../detection/types'
import { cornerLabel, detectionLabel, MIN_VISIBLE_CONFIDENCE, moveZoneCorner, nudgeZoneCorner } from './analysisModel'
import styles from './DetectionOverlay.module.css'

interface Palette {
  cattle: string
  person: string
  zone: string
  outside: string
  tag: string
  tagOutside: string
  ink: string
  font: string
}

function readPalette(element: Element): Palette {
  const css = getComputedStyle(element)
  const token = (name: string) => css.getPropertyValue(name).trim()
  return {
    cattle: token('--color-overlay-cattle'),
    person: token('--color-overlay-person'),
    zone: token('--color-overlay-lindero'),
    outside: token('--color-overlay-outside'),
    tag: token('--color-stage-tag'),
    tagOutside: token('--color-stage-tag-outside'),
    ink: token('--color-stage-ink'),
    font: token('--font-sans') || 'sans-serif',
  }
}

interface DisplayBox { box: Box; bornAt: number; goneAt: number | null; detection: Detection }

const ENTER_MS = 280
const EXIT_MS = 260

const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount

export interface DetectionOverlayProps {
  frameRef: RefObject<FrameResult | null>
  zone: Point[]
  onZoneChange: (zone: Point[]) => void
  showDetections: boolean
}

export function DetectionOverlay({ frameRef, zone, onZoneChange, showDetections }: DetectionOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const zoneRef = useRef(zone)
  const showRef = useRef(showDetections)
  const dragRef = useRef<number | null>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    zoneRef.current = zone
    showRef.current = showDetections
  }, [zone, showDetections])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const palette = readPalette(canvas)
    const display = new Map<string, DisplayBox>()
    let raf = 0

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      const dpr = window.devicePixelRatio || 1
      const width = Math.round(canvas.clientWidth * dpr)
      const height = Math.round(canvas.clientHeight * dpr)
      if (width === 0 || height === 0) return
      if (canvas.width !== width) canvas.width = width
      if (canvas.height !== height) canvas.height = height
      ctx.clearRect(0, 0, width, height)

      const polygon = zoneRef.current
      ctx.save()
      ctx.beginPath()
      polygon.forEach((point, index) => {
        const x = point.x * width
        const y = point.y * height
        if (index === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.closePath()
      ctx.globalAlpha = 0.08
      ctx.fillStyle = palette.zone
      ctx.fill()
      ctx.globalAlpha = 0.9
      ctx.setLineDash([10 * dpr, 7 * dpr])
      ctx.lineWidth = 2 * dpr
      ctx.strokeStyle = palette.zone
      ctx.stroke()
      ctx.restore()

      const frame = frameRef.current
      if (!showRef.current || !frame) {
        display.clear()
        return
      }

      const pulse = reduce ? 0.6 : 0.5 + 0.5 * Math.sin(now / 190)
      const fontSize = Math.max(11, Math.min(14, canvas.clientWidth / 52)) * dpr
      ctx.font = `600 ${fontSize}px ${palette.font}`
      ctx.textBaseline = 'middle'
      const live = new Set<string>()

      for (const detection of frame.detections) {
        if (detection.confidence < MIN_VISIBLE_CONFIDENCE) continue
        live.add(detection.trackId)
        // Ease displayed boxes toward the latest 10 Hz result so they glide instead of stepping.
        const previous = display.get(detection.trackId)
        const target = detection.box
        const box = previous && !reduce
          ? { x: lerp(previous.box.x, target.x, 0.35), y: lerp(previous.box.y, target.y, 0.35), w: lerp(previous.box.w, target.w, 0.35), h: lerp(previous.box.h, target.h, 0.35) }
          : { ...target }
        display.set(detection.trackId, { box, bornAt: previous?.bornAt ?? now, goneAt: null, detection })
      }

      for (const [id, item] of display) {
        if (!live.has(id) && item.goneAt === null) item.goneAt = now
        const exit = item.goneAt === null ? 1 : 1 - (now - item.goneAt) / EXIT_MS
        if (exit <= 0) {
          display.delete(id)
          continue
        }
        const enter = Math.min(1, (now - item.bornAt) / ENTER_MS)
        const eased = 1 - Math.pow(1 - enter, 3)
        const { detection } = item
        const grow = reduce ? 1 : 1.25 - 0.25 * eased
        const cx = (item.box.x + item.box.w / 2) * width
        const cy = (item.box.y + item.box.h / 2) * height
        const w = item.box.w * width * grow
        const h = item.box.h * height * grow
        const x = cx - w / 2
        const y = cy - h / 2
        const color = detection.outside ? palette.outside : detection.cls === 'cattle' ? palette.cattle : palette.person
        const alpha = Math.max(0.35, Math.min(1, detection.confidence / 0.8)) * eased * Math.max(0, exit)

        ctx.save()
        ctx.globalAlpha = alpha
        if (detection.outside) {
          ctx.fillStyle = color
          ctx.globalAlpha = alpha * (0.08 + 0.12 * pulse)
          ctx.fillRect(x, y, w, h)
          ctx.globalAlpha = alpha
          ctx.shadowColor = color
          ctx.shadowBlur = (8 + 14 * pulse) * dpr
        }
        ctx.strokeStyle = color
        ctx.lineWidth = (detection.outside ? 3 : 2) * dpr
        ctx.strokeRect(x, y, w, h)
        // Corner brackets read as "locked on" even on busy footage.
        const corner = Math.min(w, h) * 0.22
        ctx.lineWidth = (detection.outside ? 5 : 4) * dpr
        ctx.beginPath()
        for (const [px, py, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x + w, y + h, -1, -1], [x, y + h, 1, -1]]) {
          ctx.moveTo(px + dx * corner, py)
          ctx.lineTo(px, py)
          ctx.lineTo(px, py + dy * corner)
        }
        ctx.stroke()
        ctx.restore()

        const label = detectionLabel(detection)
        const padding = 6 * dpr
        const chipH = fontSize + 8 * dpr
        const chipW = ctx.measureText(label).width + padding * 2
        const chipX = Math.min(Math.max(0, x), width - chipW)
        const lift = reduce ? 0 : (1 - eased) * 6 * dpr
        const chipY = (y - chipH - 2 * dpr >= 0 ? y - chipH - 2 * dpr : y + 2 * dpr) + lift
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.fillStyle = detection.outside ? palette.tagOutside : palette.tag
        ctx.beginPath()
        ctx.roundRect(chipX, chipY, chipW, chipH, 6 * dpr)
        ctx.fill()
        ctx.fillStyle = color
        ctx.fillRect(chipX, chipY + 4 * dpr, 3 * dpr, chipH - 8 * dpr)
        ctx.fillStyle = palette.ink
        ctx.fillText(label, chipX + padding, chipY + chipH / 2 + dpr * 0.5)
        ctx.restore()
      }
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [frameRef, reduce])

  const pointFromEvent = (event: PointerEvent<HTMLElement>): Point | null => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return null
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }
  }

  const onPointerDown = (index: number) => (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.focus()
    dragRef.current = index
  }

  const onPointerMove = (index: number) => (event: PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current !== index) return
    const point = pointFromEvent(event)
    if (point) onZoneChange(moveZoneCorner(zone, index, point))
  }

  const endDrag = () => { dragRef.current = null }

  const onKeyDown = (index: number) => (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 0.05 : 0.01
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    onZoneChange(nudgeZoneCorner(zone, index, move[0], move[1]))
  }

  return (
    <div className={styles.overlay}>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      <div className={styles.handles} role="group" aria-label="Zona segura editable. Arrastra las esquinas o usa las flechas del teclado.">
        {zone.map((point, index) => (
          <button
            key={index}
            type="button"
            className={styles.handle}
            style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
            aria-label={cornerLabel(index, point)}
            title="Arrastra para ajustar la zona segura"
            onPointerDown={onPointerDown(index)}
            onPointerMove={onPointerMove(index)}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={onKeyDown(index)}
          >
            <span className={styles.dot} aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  )
}
