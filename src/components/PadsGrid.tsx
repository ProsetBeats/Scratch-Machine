import { useRef } from 'react'

type PadsGridProps = {
  padNames: string[]
  activePad: number | null
  onTrigger: (index: number) => void
  onLoad: (index: number, file: File) => void
}

export function PadsGrid({ padNames, activePad, onTrigger, onLoad }: PadsGridProps) {
  const fileInputsRef = useRef<Array<HTMLInputElement | null>>([])

  return (
    <div className="pads-grid">
      {padNames.map((name, index) => (
        <div className="pad-cell" key={index}>
          <button
            type="button"
            className={`pad-button ${activePad === index ? 'active' : ''}`}
            onClick={() => onTrigger(index)}
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
