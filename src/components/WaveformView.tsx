import { useEffect, useRef } from 'react'

type WaveformViewProps = {
  points: number[]
  progress: number
}

export function WaveformView({ points, progress }: WaveformViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    const width = canvas.width
    const height = canvas.height
    const center = height / 2

    context.clearRect(0, 0, width, height)
    context.fillStyle = '#171a1f'
    context.fillRect(0, 0, width, height)

    if (points.length > 0) {
      const barWidth = width / points.length
      context.fillStyle = '#7f8ca3'

      for (let i = 0; i < points.length; i += 1) {
        const amplitude = points[i]
        const barHeight = Math.max(2, amplitude * (height * 0.9))
        const x = i * barWidth
        const y = center - barHeight / 2
        context.fillRect(x, y, Math.max(1, barWidth - 1), barHeight)
      }
    }

    context.fillStyle = '#ff4040'
    const clampedProgress = Math.min(Math.max(progress, 0), 1)
    context.fillRect(clampedProgress * width, 0, 2, height)
  }, [points, progress])

  return <canvas ref={canvasRef} width={980} height={120} className="waveform-canvas" />
}
