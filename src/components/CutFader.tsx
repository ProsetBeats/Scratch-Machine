import { useRef, useCallback } from 'react'

type CutFaderProps = {
  value: number
  onChange: (value: number) => void
}

export function CutFader({ value, onChange }: CutFaderProps) {
  const trackRef = useRef<HTMLDivElement>(null)

  const calcValue = useCallback((clientX: number) => {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const ratio = (clientX - rect.left) / rect.width
    return Math.round(Math.max(0, Math.min(1, ratio)) * 100) / 100
  }, [])

  return (
    <div className="cut-fader-wrap">
      <span className="cut-label">CUT</span>
      <div
        ref={trackRef}
        className="cut-fader-track"
        role="slider"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={value}
        tabIndex={0}
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => {
          e.preventDefault()
          e.currentTarget.setPointerCapture(e.pointerId)
          onChange(calcValue(e.clientX))
        }}
        onPointerMove={(e) => {
          if (e.pressure > 0) {
            onChange(calcValue(e.clientX))
          }
        }}
      >
        <div className="cut-fader-fill" style={{ width: `${value * 100}%` }} />
        <div className="cut-fader-thumb" style={{ left: `${value * 100}%` }} />
      </div>
    </div>
  )
}
