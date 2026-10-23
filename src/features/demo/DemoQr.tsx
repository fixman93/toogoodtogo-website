/** Decorative QR-looking matrix for the /demo mockups (not a scannable code). */
const SIZE = 25

function buildPath() {
  let seed = 42
  const random = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
  const finder = (x: number, y: number) => {
    for (const [ox, oy] of [
      [0, 0],
      [SIZE - 7, 0],
      [0, SIZE - 7],
    ]) {
      const dx = x - ox
      const dy = y - oy
      if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) {
        const edge = dx === 0 || dy === 0 || dx === 6 || dy === 6
        const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4
        return edge || core
      }
      if (dx >= -1 && dx <= 7 && dy >= -1 && dy <= 7) return false
    }
    return null
  }
  const cells: string[] = []
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const f = finder(x, y)
      if (f === true || (f === null && random() > 0.52)) cells.push(`M${x} ${y}h1v1h-1z`)
    }
  }
  return cells.join('')
}

const PATH = buildPath()

export function DemoQr({ className = '' }: { className?: string }) {
  return (
    <div className={`qr ${className}`}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="QR kod">
        <path fill="#111" d={PATH} />
      </svg>
    </div>
  )
}
