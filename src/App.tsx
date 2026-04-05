import { useEffect, useRef, useState } from 'react'
import { ScratchEngine } from './audio/scratchEngine'
import { CutFader } from './components/CutFader'
import { PadsGrid } from './components/PadsGrid'
import { Turntable } from './components/Turntable'
import { WaveformView } from './components/WaveformView'
import './App.css'

const PAD_COUNT = 8
const CUT_THRESHOLD = 0.02

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
  const [padFiles, setPadFiles] = useState<Array<File | null>>(
    Array.from({ length: PAD_COUNT }, () => null),
  )
  const [activePad, setActivePad] = useState<number | null>(null)
  const [cutValue, setCutValue] = useState(0.9)

  const trackAssignmentIdRef = useRef(0)
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
      const engine = engineRef.current
      if (engine) {
        void engine.dispose()
      }
    }
  }, [])

  const loadMainTrack = async (
    file: File,
    options?: {
      autoPlay?: boolean
      assignedPad?: number | null
    },
  ) => {
    const engine = engineRef.current
    if (!engine) {
      return
    }

    const assignmentId = trackAssignmentIdRef.current + 1
    trackAssignmentIdRef.current = assignmentId

    const autoPlay = options?.autoPlay ?? false
    const assignedPad = options?.assignedPad ?? null

    await engine.loadMainTrack(file)

    if (assignmentId !== trackAssignmentIdRef.current) {
      return
    }

    setWaveformPoints(engine.getWaveformPoints())
    setDuration(engine.getMainDuration())
    setPlayhead(0)
    setTrackName(file.name)
    setIsTrackLoaded(true)
    setActivePad(assignedPad)

    if (!autoPlay) {
      setIsPlaying(false)
      return
    }

    const started = await engine.playMain()

    if (assignmentId !== trackAssignmentIdRef.current) {
      return
    }

    setIsPlaying(started)
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

  const [debugInfo, setDebugInfo] = useState({
    pxPerSec: 0,
    dt: 0,
    rate: 0,
    direction: 0,
    rawSpeed: 0,
    filteredSpeed: 0,
    eventCount: 0,
    baselineSpeed: 800,
    baselineCandidate: 0,
    engineRate: 0,
    workletRate: 0,
    scratching: false,
    workletScratching: false,
  })

  const handleScratchWithDebug = (deltaX: number) => {
    handleScratch(deltaX)
    const engine = engineRef.current
    if (engine) setDebugInfo(engine.getDebugInfo())
  }

  const handleScratchStart = () => {
    const engine = engineRef.current
    if (!engine || !isTrackLoaded) {
      return
    }

    void engine.beginScratch()
    setIsPlaying(false)
    setDebugInfo(engine.getDebugInfo())
  }

  const handleScratchEnd = async () => {
    const engine = engineRef.current
    if (!engine || !isTrackLoaded) {
      return
    }

    await engine.endScratch()
    setPlayhead(engine.getPlayhead())
    setIsPlaying(engine.isMainPlaying())
    setDebugInfo(engine.getDebugInfo())
  }

  const loadPadSample = async (index: number, file: File) => {
    setPadNames((current) => {
      const next = [...current]
      next[index] = file.name
      return next
    })

    setPadFiles((current) => {
      const next = [...current]
      next[index] = file
      return next
    })
  }

  const triggerPad = (index: number) => {
    const selectedPadFile = padFiles[index]
    if (!selectedPadFile) {
      return
    }

    void loadMainTrack(selectedPadFile, {
      autoPlay: true,
      assignedPad: index,
    })
  }

  const [baselineInput, setBaselineInput] = useState(800)

  const handleBaselineChange = (val: number) => {
    setBaselineInput(val)
    engineRef.current?.setBaselineSpeed(val)
  }

  const handleSetCurrentAs1x = () => {
    const speed = Math.abs(debugInfo.filteredSpeed)
    if (speed > 10) {
      setBaselineInput(Math.round(speed))
      engineRef.current?.setBaselineSpeed(speed)
    }
  }

  const progress = duration > 0 ? playhead / duration : 0
  const rateNear1 = Math.abs(Math.abs(debugInfo.rate) - 1.0) <= 0.1

  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <main className="scratch-app">
      <div className="left-console">
        <button
          type="button"
          className="settings-toggle"
          onClick={() => setSettingsOpen((o) => !o)}
          title="Settings"
        >
          ?
        </button>

        {settingsOpen && (
          <div className="settings-overlay">
            <div className="settings-panel">
              <div className="settings-header">
                <span>Settings</span>
                <button type="button" className="settings-close" onClick={() => setSettingsOpen(false)}>?</button>
              </div>

              <div className="settings-row">
                <button type="button" className="rec-button">REC</button>
              </div>

              <div className="settings-row">
                <span className="settings-label">Baseline: {baselineInput} px/s</span>
                <input
                  type="range"
                  min={20}
                  max={1000}
                  step={5}
                  value={baselineInput}
                  onChange={(e) => handleBaselineChange(Number(e.target.value))}
                  className="settings-slider"
                />
                <input
                  type="number"
                  min={20}
                  max={2000}
                  value={baselineInput}
                  onChange={(e) => handleBaselineChange(Number(e.target.value) || 20)}
                  className="settings-number"
                />
                <button
                  type="button"
                  className="settings-calibrate"
                  onClick={handleSetCurrentAs1x}
                >
                  Set current as 1×
                </button>
              </div>

              <div className="settings-row settings-debug">
                <div>rate: <span style={{ color: rateNear1 ? '#0f0' : '#7fa' }}>{debugInfo.rate}</span></div>
                <div>filtered: {debugInfo.filteredSpeed} px/s</div>
                <div>engineRate: {debugInfo.engineRate}</div>
                <div>workletRate: {debugInfo.workletRate}</div>
                <div>scratch: {debugInfo.scratching ? 'on' : 'off'} / {debugInfo.workletScratching ? 'on' : 'off'}</div>
                <div>head: {playhead.toFixed(3)}s</div>
              </div>
            </div>
          </div>
        )}

        <section className="top-section">
          <WaveformView points={waveformPoints} progress={progress} />
          <div className="track-controls">
            <button type="button" onClick={() => mainTrackInputRef.current?.click()}>Load</button>
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
                void loadMainTrack(file, { autoPlay: false, assignedPad: null })
                event.currentTarget.value = ''
              }}
            />
          </div>
        </section>

        <section className="pads-section">
          <PadsGrid
            padNames={padNames}
            activePad={activePad}
            onTrigger={triggerPad}
            onLoad={(index, file) => { void loadPadSample(index, file) }}
          />
        </section>

        <section className="fader-section">
          <CutFader value={cutValue} onChange={setCutValue} />
        </section>
      </div>

      <div className="right-platter">
        <Turntable
          onScratchStart={handleScratchStart}
          onScratch={handleScratchWithDebug}
          onScratchEnd={() => { void handleScratchEnd() }}
        />
      </div>
    </main>
  )
}

export default App
