const PAD_COUNT = 8

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

export class ScratchEngine {
  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private mainBuffer: AudioBuffer | null = null
  private mainSource: AudioBufferSourceNode | null = null
  private mainStartedAt = 0
  private playhead = 0
  private mainPlaying = false
  private cutOpen = true
  private readonly padBuffers: Array<AudioBuffer | null> = Array.from({ length: PAD_COUNT }, () => null)

  private async ensureAudioContext(): Promise<AudioContext> {
    if (!this.context) {
      this.context = new AudioContext()
      this.masterGain = this.context.createGain()
      this.masterGain.gain.value = this.cutOpen ? 1 : 0
      this.masterGain.connect(this.context.destination)
    }

    if (this.context.state === 'suspended') {
      await this.context.resume()
    }

    return this.context
  }

  async loadMainTrack(file: File): Promise<void> {
    const context = await this.ensureAudioContext()
    const arrayBuffer = await file.arrayBuffer()
    this.mainBuffer = await context.decodeAudioData(arrayBuffer)
    this.stopMain()
    this.playhead = 0
  }

  async playMain(): Promise<boolean> {
    if (!this.mainBuffer) {
      return false
    }

    await this.ensureAudioContext()

    if (this.mainPlaying) {
      return true
    }

    this.startMainSource()
    return true
  }

  stopMain(): void {
    if (!this.mainBuffer) {
      return
    }

    const current = this.getPlayhead()
    this.cleanupMainSource()
    this.playhead = current >= this.mainBuffer.duration ? 0 : current
    this.mainPlaying = false
  }

  isMainPlaying(): boolean {
    return this.mainPlaying
  }

  getMainDuration(): number {
    return this.mainBuffer?.duration ?? 0
  }

  getPlayhead(): number {
    if (!this.mainBuffer || !this.context || !this.mainPlaying) {
      return this.playhead
    }

    return clamp(this.context.currentTime - this.mainStartedAt, 0, this.mainBuffer.duration)
  }

  scratchByDelta(deltaX: number): void {
    if (!this.mainBuffer) {
      return
    }

    const secondsPerPixel = this.mainBuffer.duration / 900
    this.playhead = clamp(this.getPlayhead() + deltaX * secondsPerPixel, 0, this.mainBuffer.duration)

    if (this.mainPlaying) {
      this.startMainSource()
    }
  }

  setCutOpen(open: boolean): void {
    this.cutOpen = open

    if (!this.context || !this.masterGain) {
      return
    }

    this.masterGain.gain.setValueAtTime(open ? 1 : 0, this.context.currentTime)
  }

  async loadPadSample(index: number, file: File): Promise<void> {
    if (index < 0 || index >= PAD_COUNT) {
      return
    }

    const context = await this.ensureAudioContext()
    const arrayBuffer = await file.arrayBuffer()
    this.padBuffers[index] = await context.decodeAudioData(arrayBuffer)
  }

  async triggerPad(index: number): Promise<void> {
    if (index < 0 || index >= PAD_COUNT) {
      return
    }

    const sample = this.padBuffers[index]
    if (!sample) {
      return
    }

    const context = await this.ensureAudioContext()
    if (!this.masterGain) {
      return
    }

    const source = context.createBufferSource()
    source.buffer = sample
    source.connect(this.masterGain)
    source.start()
  }

  getWaveformPoints(pointCount = 240): number[] {
    if (!this.mainBuffer) {
      return []
    }

    const data = this.mainBuffer.getChannelData(0)
    const blockSize = Math.max(1, Math.floor(data.length / pointCount))
    const points: number[] = []

    for (let i = 0; i < pointCount; i += 1) {
      const start = i * blockSize
      const end = Math.min(start + blockSize, data.length)
      let max = 0

      for (let j = start; j < end; j += 1) {
        const value = Math.abs(data[j])
        if (value > max) {
          max = value
        }
      }

      points.push(max)
    }

    return points
  }

  async dispose(): Promise<void> {
    this.cleanupMainSource()
    this.mainPlaying = false

    if (this.context) {
      await this.context.close()
    }

    this.context = null
    this.masterGain = null
  }

  private startMainSource(): void {
    if (!this.context || !this.mainBuffer || !this.masterGain) {
      return
    }

    this.cleanupMainSource()

    const source = this.context.createBufferSource()
    source.buffer = this.mainBuffer
    source.connect(this.masterGain)
    source.onended = () => {
      if (source !== this.mainSource) {
        return
      }

      const reachedEnd = this.getPlayhead() >= this.mainBuffer!.duration
      this.cleanupMainSource()
      this.mainPlaying = false
      this.playhead = reachedEnd ? 0 : this.playhead
    }

    const offset = clamp(this.playhead, 0, Math.max(0, this.mainBuffer.duration - 0.01))
    source.start(0, offset)

    this.mainSource = source
    this.mainStartedAt = this.context.currentTime - offset
    this.mainPlaying = true
  }

  private cleanupMainSource(): void {
    if (!this.mainSource) {
      return
    }

    this.mainSource.onended = null

    try {
      this.mainSource.stop()
    } catch {
      // ignored
    }

    this.mainSource.disconnect()
    this.mainSource = null
  }
}
