const SPEED_WINDOW_MS = 30
const DEFAULT_BASELINE = 800
const RATE_SMOOTH = 0.25
const MAX_RATE = 2

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

export class ScratchEngine {
  private ctx: AudioContext | null = null
  private gain: GainNode | null = null
  private buf: AudioBuffer | null = null
  private node: AudioWorkletNode | null = null
  private ready = false
  private head = 0
  private playing = false
  private scratching = false
  private wasPlaying = false
  private cutOpen = true
  private baselineSpeed = DEFAULT_BASELINE
  private speedSamples: Array<{ dx: number; dt: number; t: number }> = []
  private lastEventTime = 0
  private currentRate = 0
  private debugInfo = {
    pxPerSec: 0,
    dt: 0,
    rate: 0,
    direction: 0,
    rawSpeed: 0,
    filteredSpeed: 0,
    eventCount: 0,
    baselineSpeed: DEFAULT_BASELINE,
    baselineCandidate: 0,
    engineRate: 0,
    workletRate: 0,
    scratching: false,
    workletScratching: false,
  }

  private async boot(): Promise<AudioContext> {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.gain = this.ctx.createGain()
      this.gain.gain.value = this.cutOpen ? 1 : 0
      this.gain.connect(this.ctx.destination)
    }
    if (!this.ready) {
      await this.ctx.audioWorklet.addModule('/worklets/scratchPlaybackProcessor.js')
      this.ready = true
    }
    if (!this.node) this.wire()
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    return this.ctx
  }

  async loadMainTrack(file: File): Promise<void> {
    const ctx = await this.boot()
    this.buf = await ctx.decodeAudioData(await file.arrayBuffer())
    this.playing = false
    this.scratching = false
    this.wasPlaying = false
    this.head = 0
    this.currentRate = 0
    this.speedSamples = []
    this.lastEventTime = 0

    this.send({ type: 'play', on: false })
    this.send({ type: 'scratch', on: false })
    this.send({ type: 'rate', value: 0 })
    this.send({ type: 'seek', pos: 0 })
    this.pushBuffer()
  }

  async playMain(): Promise<boolean> {
    if (!this.buf) return false
    await this.boot()
    this.playing = true
    this.send({ type: 'play', on: true })
    return true
  }

  stopMain(): void {
    if (!this.buf) return
    this.playing = false
    this.send({ type: 'play', on: false })
  }

  isMainPlaying(): boolean { return this.playing }
  getMainDuration(): number { return this.buf?.duration ?? 0 }
  getPlayhead(): number { return this.head }
  getDebugInfo(): typeof this.debugInfo { return this.debugInfo }
  getBaselineSpeed(): number { return this.baselineSpeed }

  setBaselineSpeed(pxPerSec: number): void {
    if (pxPerSec > 50) {
      this.baselineSpeed = pxPerSec
      this.debugInfo.baselineSpeed = Math.round(pxPerSec)
    }
  }

  scratchByDelta(deltaX: number): void {
    if (!this.buf || !this.ctx || !this.scratching || deltaX === 0) return

    const now = performance.now()
    const dt = now - this.lastEventTime
    this.lastEventTime = now

    if (dt < 0.5 || dt > 200) return

    // Collect sample
    this.speedSamples.push({ dx: deltaX, dt, t: now })
    this.trimSpeedSamples(now)

    // Compute robust speed: sum(dx) / sum(dt) over window
    const totalDx = this.speedSamples.reduce((s, e) => s + e.dx, 0)
    const totalDt = this.speedSamples.reduce((s, e) => s + e.dt, 0)

    if (totalDt < 1) return

    const pxPerSec = (totalDx / totalDt) * 1000
    const targetRate = clamp(pxPerSec / this.baselineSpeed, -MAX_RATE, MAX_RATE)

    // Stable rate: smooth toward target
    this.currentRate += (targetRate - this.currentRate) * RATE_SMOOTH

    // Debug
    this.debugInfo = {
      pxPerSec: Math.round(pxPerSec),
      dt: Math.round(dt * 10) / 10,
      rate: Math.round(this.currentRate * 100) / 100,
      direction: Math.sign(this.currentRate),
      rawSpeed: Math.round((deltaX / dt) * 1000),
      filteredSpeed: Math.round(pxPerSec),
      eventCount: this.speedSamples.length,
      baselineSpeed: Math.round(this.baselineSpeed),
      baselineCandidate: Math.round(Math.abs(pxPerSec)),
      engineRate: Math.round(this.currentRate * 100) / 100,
      workletRate: this.debugInfo.workletRate,
      scratching: this.scratching,
      workletScratching: this.debugInfo.workletScratching,
    }

    // Send stable rate to worklet
    this.send({ type: 'rate', value: this.currentRate })
  }

  async beginScratch(): Promise<void> {
    if (!this.buf) return
    await this.boot()
    this.wasPlaying = this.playing
    this.playing = false
    this.scratching = true
    this.debugInfo.scratching = true
    const now = performance.now()
    this.lastEventTime = now
    this.trimSpeedSamples(now)
    this.send({ type: 'play', on: false })
    this.send({ type: 'scratch', on: true })
    this.send({ type: 'rate', value: this.currentRate })
    this.send({ type: 'seek', pos: this.head })
  }

  async endScratch(): Promise<void> {
    if (!this.scratching) return
    this.scratching = false
    this.debugInfo.scratching = false
    this.trimSpeedSamples(performance.now())
    this.send({ type: 'rate', value: 0 })
    this.send({ type: 'scratch', on: false })
    this.send({ type: 'seek', pos: this.head })
    if (this.wasPlaying) {
      this.playing = true
      this.send({ type: 'play', on: true })
    }
    this.wasPlaying = false
  }

  setCutOpen(open: boolean): void {
    this.cutOpen = open
    if (this.ctx && this.gain) {
      this.gain.gain.setValueAtTime(open ? 1 : 0, this.ctx.currentTime)
    }
  }

  getWaveformPoints(count = 240): number[] {
    if (!this.buf) return []
    const data = this.buf.getChannelData(0)
    const block = Math.max(1, Math.floor(data.length / count))
    const pts: number[] = []
    for (let i = 0; i < count; i++) {
      const s = i * block
      const e = Math.min(s + block, data.length)
      let mx = 0
      for (let j = s; j < e; j++) { const v = Math.abs(data[j]); if (v > mx) mx = v }
      pts.push(mx)
    }
    return pts
  }

  async dispose(): Promise<void> {
    if (this.node) { this.node.port.onmessage = null; this.node.disconnect(); this.node = null }
    if (this.ctx) await this.ctx.close()
    this.ctx = null; this.gain = null; this.buf = null
    this.playing = false; this.scratching = false; this.wasPlaying = false; this.ready = false
  }

  private wire(): void {
    if (!this.ctx || !this.gain || this.node) return
    const n = new AudioWorkletNode(this.ctx, 'scratch-processor', {
      numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
    })
    n.connect(this.gain)
    n.port.onmessage = (e: MessageEvent<{ head?: number; playing?: boolean; rate?: number; scratching?: boolean }>) => {
      if (typeof e.data.head === 'number') this.head = e.data.head
      if (typeof e.data.playing === 'boolean' && !this.scratching) this.playing = e.data.playing
      if (typeof e.data.rate === 'number') this.debugInfo.workletRate = Math.round(e.data.rate * 100) / 100
      if (typeof e.data.scratching === 'boolean') this.debugInfo.workletScratching = e.data.scratching
    }
    this.node = n
  }

  private pushBuffer(): void {
    if (!this.buf) return
    const L = new Float32Array(this.buf.getChannelData(0))
    const R = new Float32Array(this.buf.numberOfChannels > 1 ? this.buf.getChannelData(1) : this.buf.getChannelData(0))
    this.send({ type: 'load', left: L.buffer, right: R.buffer }, [L.buffer, R.buffer])
  }

  private trimSpeedSamples(now: number): void {
    const cutoff = now - SPEED_WINDOW_MS
    this.speedSamples = this.speedSamples.filter((sample) => sample.t >= cutoff)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private send(msg: any, transfer?: Transferable[]): void {
    this.node?.port.postMessage(msg, transfer ?? [])
  }
}
