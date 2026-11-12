import { useMemo } from 'react'
import qrcode from 'qrcode-generator'

/** A QR drawn as an SVG path: stays sharp on any screen, and works under the app's content security policy. */
export function QrCode({ value, label }: { value: string; label: string }) {
  const { size, path } = useMemo(() => {
    const code = qrcode(0, 'M')
    code.addData(value)
    code.make()
    const count = code.getModuleCount()
    let cells = ''
    for (let row = 0; row < count; row++) {
      for (let column = 0; column < count; column++) {
        if (code.isDark(row, column)) cells += `M${column} ${row}h1v1h-1z`
      }
    }
    return { size: count, path: cells }
  }, [value])
  // Four modules of white around it: phones need that quiet zone to find the code, whatever the page's theme.
  return <svg viewBox={`-4 -4 ${size + 8} ${size + 8}`} role="img" aria-label={label} shapeRendering="crispEdges">
    <rect x="-4" y="-4" width={size + 8} height={size + 8} fill="#ffffff" />
    <path d={path} fill="#000000" />
  </svg>
}
