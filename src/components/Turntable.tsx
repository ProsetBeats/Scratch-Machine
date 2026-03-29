import { useRef, useState } from 'react'

type TurntableProps = {
  onScratch: (deltaX: number) => void
}

export function Turntable({ onScratch }: TurntableProps) {
  const [rotation, setRotation] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const lastX = useRef(0)

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true)
    lastX.current = event.clientX
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) {
      return
    }

    const deltaX = event.clientX - lastX.current
    lastX.current = event.clientX

    onScratch(deltaX)
    setRotation((previous) => previous + deltaX * 0.7)
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <div
      className={`turntable ${isDragging ? 'active' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="button"
      tabIndex={0}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <div className="vinyl-label" />
    </div>
  )
}
