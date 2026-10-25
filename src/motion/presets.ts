// Motion tokens shared by every animated component. Durations are seconds (motion/react units)
// and mirror the CSS custom properties in tokens.css.
export const ease = {
  out: [0.16, 1, 0.3, 1],
  fluid: [0.32, 0.72, 0, 1],
  in: [0.64, 0, 0.78, 0],
} as const

export const duration = { micro: 0.14, state: 0.22, panel: 0.36, reveal: 0.6 } as const

export const STAGGER_STEP = 0.05
export const STAGGER_MAX_ITEMS = 8

// Items past STAGGER_MAX_ITEMS share the last delay, so long lists never crawl in.
export function staggerDelay(index: number) {
  return Math.min(index, STAGGER_MAX_ITEMS) * STAGGER_STEP
}
