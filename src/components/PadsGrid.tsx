import { useRef, useCallback } from 'react'

const LONG_PRESS_MS = 500

type PadsGridProps = {
  padNames: string[]
  activePad: number | null
  onTrigger: (index: number) => void
  onLoad: (index: number, file: File) => void
}

export function PadsGrid({ padNames, activePad, onTrigger, onLoad }: PadsGridProps) {
  const fileInputsRef = useRef<Array<HTMLInputElement | null>>([])
  const longPressTimers = useRef<Array<ReturnType<typeof setTimeout> | null>>([])
  const longPressTriggered = useRef<boolean[]>([])

  const handlePointerDown = useCallback((index: number) => {
    longPressTriggered.current[index] = false
    longPressTimers.current[index] = setTimeout(() => {
      longPressTriggered.current[index] = true
      fileInputsRef.current[index]?.click()
    }, LONG_PRESS_MS)
  }, [])

  const handlePointerUp = useCallback((index: number) => {
    const timer = longPressTimers.current[index]
    if (timer) {
      clearTimeout(timer)
      longPressTimers.current[index] = null
    }
  }, [])

  const handleClick = useCallback((index: number) => {
    if (!longPressTriggered.current[index]) {
      onTrigger(index)
    }
  }, [onTrigger])

  return (
    <div className="pads-grid">
      {padNames.map((name, index) => (
        <div className="pad-cell" key={index}>
          <button
            type="button"
            className={`pad-button ${activePad === index ? 'active' : ''}`}
            onClick={() => handleClick(index)}
            onPointerDown={() => handlePointerDown(index)}
            onPointerUp={() => handlePointerUp(index)}
            onPointerCancel={() => handlePointerUp(index)}
          >
            PAD {index + 1}
            <span className="pad-name">{name}</span>
          </button>

          <button
            type="button"
            className="pad-load"
            onClick={() => fileInputsRef.current[index]?.click()}
          >
            Load
          </button>

          <input
            ref={(node) => {
              fileInputsRef.current[index] = node
            }}
            type="file"
            accept="audio/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) {
                return
              }

              onLoad(index, file)
              event.currentTarget.value = ''
            }}
          />
        </div>
      ))}
    </div>
  )
}
