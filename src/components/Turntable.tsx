import * as React from 'react'
import { useRef, useState, useCallback } from 'react'

type TurntableProps = {
  onScratchStart: () => void
  onScratch: (deltaX: number) => void
  onScratchEnd: () => void
}

const ANGLE_TO_PX = 80 / Math.PI

function getAngle(clientX: number, clientY: number, rect: DOMRect): number {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  return Math.atan2(clientY - cy, clientX - cx)
}

function normalizeAngleDelta(delta: number): number {
  if (delta > Math.PI) return delta - 2 * Math.PI
  if (delta < -Math.PI) return delta + 2 * Math.PI
  return delta
}

export function Turntable({ onScratchStart, onScratch, onScratchEnd }: TurntableProps) {
  const [rotation, setRotation] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const discRef = useRef<HTMLDivElement>(null)
  const lastX = useRef(0)
  const lastAngle = useRef(0)
  const isTouch = useRef(false)

  const applyDelta = useCallback((delta: number, degrees: number) => {
    if (delta === 0) return
    onScratch(delta)
    setRotation((r) => r + degrees)
  }, [onScratch])

  const applyLinear = useCallback((clientX: number) => {
    const dx = clientX - lastX.current
    lastX.current = clientX
    applyDelta(dx, dx * 0.7)
  }, [applyDelta])

  const applyCircular = useCallback((clientX: number, clientY: number) => {
    const el = discRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const angle = getAngle(clientX, clientY, rect)
    const delta = normalizeAngleDelta(angle - lastAngle.current)
    lastAngle.current = angle
    const px = delta * ANGLE_TO_PX
    const deg = (delta * 180) / Math.PI
    applyDelta(px, deg)
  }, [applyDelta])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const touch = event.pointerType === 'touch'
    isTouch.current = touch
    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)

    if (touch) {
      const rect = event.currentTarget.getBoundingClientRect()
      lastAngle.current = getAngle(event.clientX, event.clientY, rect)
    } else {
      lastX.current = event.clientX
    }

    onScratchStart()
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (!isDragging) return

    if (isTouch.current) {
      const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? []
      if (coalesced.length > 0) {
        for (const e of coalesced) applyCircular(e.clientX, e.clientY)
      } else {
        applyCircular(event.clientX, event.clientY)
      }
    } else {
      const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? []
      if (coalesced.length > 0) {
        for (const e of coalesced) applyLinear(e.clientX)
      } else {
        applyLinear(event.clientX)
      }
    }
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (!isDragging) return
    setIsDragging(false)
    event.currentTarget.releasePointerCapture(event.pointerId)
    onScratchEnd()
  }

  return (
    <div
      ref={discRef}
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
