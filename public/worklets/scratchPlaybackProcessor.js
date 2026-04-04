const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)

// 4-point Hermite interpolation for smooth resampling
function hermite(buf, len, pos) {
  const i = Math.floor(pos)
  const f = pos - i
  const i0 = Math.max(0, Math.min(i - 1, len - 1))
  const i1 = Math.max(0, Math.min(i,     len - 1))
  const i2 = Math.max(0, Math.min(i + 1, len - 1))
  const i3 = Math.max(0, Math.min(i + 2, len - 1))

  const y0 = buf[i0], y1 = buf[i1], y2 = buf[i2], y3 = buf[i3]

  const c0 = y1
  const c1 = 0.5 * (y2 - y0)
  const c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3
  const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2)

  return ((c3 * f + c2) * f + c1) * f + c0
}

class ScratchProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.bufL = null
    this.bufR = null
    this.len = 0
    this.head = 0
    this.rate = 0
    this.playing = false
    this.scratching = false
    this.tick = 0

    this.port.onmessage = ({ data }) => {
      if (data.type === 'load') {
        this.bufL = new Float32Array(data.left)
        this.bufR = new Float32Array(data.right)
        this.len = this.bufL.length
        this.head = 0
        this.rate = 0
        this.playing = false
        this.scratching = false
        this.emit()
      } else if (data.type === 'play') {
        this.playing = !!data.on
        this.emit()
      } else if (data.type === 'scratch') {
        this.scratching = !!data.on
        this.rate = 0
        this.emit()
      } else if (data.type === 'seek') {
        if (this.len > 0) {
          this.head = clamp(data.pos * sampleRate, 0, this.len - 1)
        }
        this.emit()
      } else if (data.type === 'rate') {
        if (this.scratching) {
          this.rate = Number(data.value) || 0
          this.emit()
        }
      }
    }
  }

  process(_, outputs) {
    const ch = outputs[0]
    if (!ch || !ch.length) return true
    const L = ch[0]
    const R = ch[1] || L
    const N = L.length

    if (!this.bufL || this.len === 0) {
      L.fill(0)
      R.fill(0)
      return true
    }

    for (let i = 0; i < N; i++) {
      if (this.scratching) {
        this.head += this.rate
      } else if (this.playing) {
        this.head += 1
      }

      if (this.head < 0) this.head = 0
      if (this.head > this.len - 1) {
        this.head = this.len - 1
        if (!this.scratching) this.playing = false
      }

      L[i] = hermite(this.bufL, this.len, this.head)
      R[i] = hermite(this.bufR, this.len, this.head)
    }

    if (++this.tick >= 6) {
      this.tick = 0
      this.emit()
    }
    return true
  }

  emit() {
    this.port.postMessage({
      head: this.len > 0 ? this.head / sampleRate : 0,
      playing: this.playing,
      rate: this.rate,
      scratching: this.scratching,
    })
  }
}

registerProcessor('scratch-processor', ScratchProcessor)
