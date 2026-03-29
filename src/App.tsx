import { useEffect, useRef, useState } from 'react'
import { ScratchEngine } from './audio/scratchEngine'
import { CutFader } from './components/CutFader'
import { PadsGrid } from './components/PadsGrid'
import { Turntable } from './components/Turntable'
import { WaveformView } from './components/WaveformView'
import './App.css'

const PAD_COUNT = 8
const CUT_THRESHOLD = 0.55

function App() {
  const engineRef = useRef<ScratchEngine | null>(null)
  if (!engineRef.current) {
    engineRef.current = new ScratchEngine()
  }

  const [isTrackLoaded, setIsTrackLoaded] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [trackName, setTrackName] = useState('No main track loaded')
  const [waveformPoints, setWaveformPoints] = useState<number[]>([])
  const [duration, setDuration] = useState(0)
  const [playhead, setPlayhead] = useState(0)
  const [padNames, setPadNames] = useState<string[]>(
    Array.from({ length: PAD_COUNT }, () => 'No sample'),
  )
  const [activePad, setActivePad] = useState<number | null>(null)
  const [cutValue, setCutValue] = useState(0.9)

  const padFlashTimeoutRef = useRef<number | null>(null)
  const mainTrackInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) {
      return
    }

    engine.setCutOpen(cutValue >= CUT_THRESHOLD)
  }, [cutValue])

  useEffect(() => {
    if (!isPlaying) {
      return
    }

    const timer = window.setInterval(() => {
      const engine = engineRef.current
      if (!engine) {
        return
      }

      const current = engine.getPlayhead()
      setPlayhead(current)

      if (!engine.isMainPlaying()) {
        setIsPlaying(false)
      }
    }, 40)

    return () => window.clearInterval(timer)
  }, [isPlaying])

  useEffect(() => {
    return () => {
      if (padFlashTimeoutRef.current) {
        window.clearTimeout(padFlashTimeoutRef.current)
      }

      const engine = engineRef.current
      if (engine) {
        void engine.dispose()
      }
    }
  }, [])

  const loadMainTrack = async (file: File) => {
    const engine = engineRef.current
    if (!engine) {
      return
    }

    await engine.loadMainTrack(file)
    setWaveformPoints(engine.getWaveformPoints())
    setDuration(engine.getMainDuration())
    setPlayhead(0)
    setTrackName(file.name)
    setIsTrackLoaded(true)
    setIsPlaying(false)
  }

  const togglePlay = async () => {
    const engine = engineRef.current
    if (!engine || !isTrackLoaded) {
      return
    }

    if (isPlaying) {
      engine.stopMain()
      setPlayhead(engine.getPlayhead())
      setIsPlaying(false)
      return
    }

    const started = await engine.playMain()
    setIsPlaying(started)
  }

  const handleScratch = (deltaX: number) => {
    const engine = engineRef.current
    if (!engine || !isTrackLoaded) {
      return
    }

    engine.scratchByDelta(deltaX)
    setPlayhead(engine.getPlayhead())
  }

  const loadPadSample = async (index: number, file: File) => {
    const engine = engineRef.current
    if (!engine) {
      return
    }

    await engine.loadPadSample(index, file)
    setPadNames((current) => {
      const next = [...current]
      next[index] = file.name
      return next
    })
  }

  const triggerPad = (index: number) => {
    const engine = engineRef.current
    if (!engine) {
      return
    }

    void engine.triggerPad(index)
    setActivePad(index)

    if (padFlashTimeoutRef.current) {
      window.clearTimeout(padFlashTimeoutRef.current)
    }

    padFlashTimeoutRef.current = window.setTimeout(() => {
      setActivePad(null)
    }, 120)
  }

  const progress = duration > 0 ? playhead / duration : 0

  return (
    <main className="scratch-app">
      <section className="top-section">
        <WaveformView points={waveformPoints} progress={progress} />

        <div className="track-controls">
          <button type="button" onClick={() => mainTrackInputRef.current?.click()}>
            Load Main Track
          </button>
          <button type="button" onClick={() => void togglePlay()} disabled={!isTrackLoaded}>
            {isPlaying ? 'Stop' : 'Play'}
          </button>
          <span className="track-name">{trackName}</span>
          <input
            ref={mainTrackInputRef}
            type="file"
            accept="audio/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) {
                return
              }

              void loadMainTrack(file)
              event.currentTarget.value = ''
            }}
          />
        </div>
      </section>

      <section className="middle-section">
        <aside className="left-pads">
          <PadsGrid
            padNames={padNames}
            activePad={activePad}
            onTrigger={triggerPad}
            onLoad={(index, file) => {
              void loadPadSample(index, file)
            }}
          />
        </aside>

        <section className="right-turntable">
          <Turntable onScratch={handleScratch} />
        </section>
      </section>

      <section className="bottom-section">
        <CutFader value={cutValue} onChange={setCutValue} />
        <button type="button" className="rec-button">
          REC
        </button>
      </section>
    </main>
  )
}

export default App
