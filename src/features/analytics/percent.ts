/** Integer percentages that preserve the total using largest-remainder rounding. */
export function largestRemainderPercentages(counts: readonly number[]): number[] {
  const total = counts.reduce((sum, count) => sum + count, 0)
  if (total <= 0) return counts.map(() => 0)

  const rounded = counts.map((count, index) => {
    const exact = count * 100 / total
    const floor = Math.floor(exact)
    return { index, floor, remainder: exact - floor }
  })
  let remaining = 100 - rounded.reduce((sum, item) => sum + item.floor, 0)
  const byRemainder = [...rounded].sort((a, b) => b.remainder - a.remainder || a.index - b.index)

  for (const item of byRemainder) {
    if (remaining === 0) break
    rounded[item.index].floor += 1
    remaining -= 1
  }
  return rounded.map(item => item.floor)
}

export function percentageOf(count: number, total: number): number {
  return total > 0 ? Math.round(count * 100 / total) : 0
}

export function formatPercentage(value: number): string {
  return `${Math.round(value)} %`
}
