// Synthwave Audio System — Web Audio API, zero dependencies
// All sound generated procedurally (no audio files)

import type { EnemyType } from './enemy'

type AttackSoundType = 'light' | 'heavy' | 'pulse' | 'flicker'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const bufferSize = Math.ceil(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  // Pink noise approximation (warmer than white)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < bufferSize; i++) {
    const w = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + w * 0.0555179
    b1 = 0.99332 * b1 + w * 0.0750759
    b2 = 0.96900 * b2 + w * 0.1538520
    b3 = 0.86650 * b3 + w * 0.3104856
    b4 = 0.55000 * b4 + w * 0.5329522
    b5 = -0.7616 * b5 - w * 0.0168980
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
    b6 = w * 0.115926
  }
  return buffer
}

function createImpulseResponse(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
  const bufferSize = Math.ceil(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, decay)
    }
  }
  return buffer
}

// C minor pentatonic notes in Hz (C3 = 130.81)
const NOTES = {
  C2: 65.41, G2: 98.00, Bb2: 116.54,
  C3: 130.81, Eb3: 155.56, G3: 196.00, Bb3: 233.08,
  C4: 261.63, Eb4: 311.13, G4: 392.00, Bb4: 466.16,
  C5: 523.25,
}

const BPM = 120
const BEAT = 60 / BPM           // 0.5s
const SIXTEENTH = BEAT / 4      // 0.125s

// Arpeggio pattern — 16 steps, C minor pentatonic
const ARP_PATTERN: number[] = [
  NOTES.C3, NOTES.G3, NOTES.Eb3, NOTES.Bb3,
  NOTES.C4, NOTES.G3, NOTES.Eb3, NOTES.C3,
  NOTES.G2, NOTES.Bb2, NOTES.C3, NOTES.G3,
  NOTES.Eb4, NOTES.C4, NOTES.Bb3, NOTES.G3,
]

// Bass pattern — 8 steps, 1 = play, 0 = rest
const BASS_PATTERN = [1, 0, 0, 1, 0, 1, 0, 0]

// ─── Audio Engine ─────────────────────────────────────────────────────────────

class AudioEngine {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private musicGain: GainNode | null = null

  // Music layers
  private padNodes: OscillatorNode[] = []
  private padGains: GainNode[] = []
  private reverbNode: ConvolverNode | null = null
  private reverbGain: GainNode | null = null

  // Arpeggio & Bass scheduler
  private scheduleAhead = 0.1   // seconds to schedule ahead
  private scheduleInterval = 80 // ms between scheduler runs
  private nextNoteTime = 0
  private arpStep = 0
  private bassStep = 0
  private schedulerHandle: ReturnType<typeof setInterval> | null = null

  // Layer gains (separate GainNode per layer for independent control)
  private bassGain: GainNode | null = null
  private arpGain: GainNode | null = null
  private leadGain: GainNode | null = null
  private percGain: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null

  // Last Stand
  private heartbeatHandle: ReturnType<typeof setInterval> | null = null
  private musicMuted = false
  private currentIntensity = 0

  // ─── Init ──────────────────────────────────────────────────────────────────

  init(): void {
    if (this.ctx) return
    if (typeof window === 'undefined') return
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new AC()
      this._setupGraph()
      this._startPad()
      this._startScheduler()
      this.noiseBuffer = createNoiseBuffer(this.ctx, 2.0)
    } catch {
      // Audio not available
    }
  }

  private _setupGraph(): void {
    const ctx = this.ctx!

    this.masterGain = ctx.createGain()
    this.masterGain.gain.value = 0.65
    this.masterGain.connect(ctx.destination)

    this.sfxGain = ctx.createGain()
    this.sfxGain.gain.value = 0.55
    this.sfxGain.connect(this.masterGain)

    this.musicGain = ctx.createGain()
    this.musicGain.gain.value = 0
    this.musicGain.connect(this.masterGain)
    // Fade in music over 2s
    this.musicGain.gain.linearRampToValueAtTime(0.38, ctx.currentTime + 2.5)

    // Reverb
    this.reverbNode = ctx.createConvolver()
    this.reverbNode.buffer = createImpulseResponse(ctx, 1.5, 3)
    this.reverbGain = ctx.createGain()
    this.reverbGain.gain.value = 0.18
    this.reverbNode.connect(this.reverbGain)
    this.reverbGain.connect(this.musicGain)

    // Sub-layer gains (initially silent, brought up by setMusicIntensity)
    this.bassGain = ctx.createGain()
    this.bassGain.gain.value = 0
    this.bassGain.connect(this.musicGain)

    this.arpGain = ctx.createGain()
    this.arpGain.gain.value = 0
    this.arpGain.connect(this.musicGain)
    this.arpGain.connect(this.reverbNode)

    this.leadGain = ctx.createGain()
    this.leadGain.gain.value = 0
    this.leadGain.connect(this.musicGain)

    this.percGain = ctx.createGain()
    this.percGain.gain.value = 0
    this.percGain.connect(this.musicGain)
  }

  // ─── Pad (ambient drone, always on) ────────────────────────────────────────

  private _startPad(): void {
    const ctx = this.ctx!
    const padFreqs = [NOTES.C3, NOTES.Eb3 * 1.001, NOTES.G3 * 0.999, NOTES.Bb3 * 1.002]
    const padGainValues = [0.06, 0.05, 0.06, 0.04]

    for (let i = 0; i < padFreqs.length; i++) {
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = padFreqs[i]

      // Slow LFO for vibrato
      const lfo = ctx.createOscillator()
      lfo.type = 'sine'
      lfo.frequency.value = 0.15 + i * 0.07

      const lfoGain = ctx.createGain()
      lfoGain.gain.value = 0.8
      lfo.connect(lfoGain)
      lfoGain.connect(osc.frequency)

      const g = ctx.createGain()
      g.gain.value = padGainValues[i]
      osc.connect(g)
      g.connect(this.musicGain!)
      g.connect(this.reverbNode!)

      osc.start()
      lfo.start()
      this.padNodes.push(osc)
      this.padGains.push(g)
    }
  }

  // ─── Scheduler ─────────────────────────────────────────────────────────────

  private _startScheduler(): void {
    if (!this.ctx) return
    this.nextNoteTime = this.ctx.currentTime + 0.5
    this.schedulerHandle = setInterval(() => {
      if (!this.ctx) return
      while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAhead) {
        this._scheduleNote(this.nextNoteTime)
        this.nextNoteTime += SIXTEENTH
      }
    }, this.scheduleInterval)
  }

  private _scheduleNote(time: number): void {
    const ctx = this.ctx!

    // Bass (every 8 steps = 2 beats)
    if (this.currentIntensity >= 2 && this.bassGain) {
      if (BASS_PATTERN[this.bassStep % BASS_PATTERN.length]) {
        this._playBassNote(NOTES.C2, time)
      }
      if (this.arpStep % 2 === 0) this.bassStep++
    }

    // Arpeggio (every step = 16th note)
    if (this.currentIntensity >= 3 && this.arpGain) {
      const freq = ARP_PATTERN[this.arpStep % ARP_PATTERN.length]
      this._playArpNote(freq, time)
    }

    // Lead (every 8 steps)
    if (this.currentIntensity >= 5 && this.leadGain && this.arpStep % 8 === 0) {
      const leadNote = [NOTES.Eb4, NOTES.G4, NOTES.Bb4, NOTES.C5][Math.floor(this.arpStep / 8) % 4]
      this._playLeadNote(leadNote, time)
    }

    // Percussion
    if (this.currentIntensity >= 6 && this.percGain) {
      if (this.arpStep % 8 === 0) this._playKick(time)
      if (this.arpStep % 4 === 2) this._playHihat(time)
    } else if (this.currentIntensity >= 4 && this.percGain) {
      if (this.arpStep % 8 === 0) this._playKick(time)
    }

    this.arpStep++
  }

  private _playBassNote(freq: number, time: number): void {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = freq

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 350
    filter.Q.value = 2

    const env = ctx.createGain()
    env.gain.setValueAtTime(0, time)
    env.gain.linearRampToValueAtTime(0.55, time + 0.01)
    env.gain.exponentialRampToValueAtTime(0.01, time + BEAT * 0.8)

    osc.connect(filter)
    filter.connect(env)
    env.connect(this.bassGain!)
    osc.start(time)
    osc.stop(time + BEAT)
  }

  private _playArpNote(freq: number, time: number): void {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.value = freq

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = freq * 2
    filter.Q.value = 3

    const env = ctx.createGain()
    env.gain.setValueAtTime(0, time)
    env.gain.linearRampToValueAtTime(0.22, time + 0.005)
    env.gain.exponentialRampToValueAtTime(0.001, time + SIXTEENTH * 0.85)

    osc.connect(filter)
    filter.connect(env)
    env.connect(this.arpGain!)
    osc.start(time)
    osc.stop(time + SIXTEENTH)
  }

  private _playLeadNote(freq: number, time: number): void {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = freq

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = freq * 3
    filter.Q.value = 4

    const env = ctx.createGain()
    env.gain.setValueAtTime(0, time)
    env.gain.linearRampToValueAtTime(0.3, time + 0.02)
    env.gain.setValueAtTime(0.25, time + BEAT * 0.6)
    env.gain.linearRampToValueAtTime(0, time + BEAT * 0.9)

    osc.connect(filter)
    filter.connect(env)
    env.connect(this.leadGain!)
    osc.start(time)
    osc.stop(time + BEAT)
  }

  private _playKick(time: number): void {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(150, time)
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.08)

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.7, time)
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.18)

    osc.connect(env)
    env.connect(this.percGain!)
    osc.start(time)
    osc.stop(time + 0.2)
  }

  private _playHihat(time: number): void {
    const ctx = this.ctx!
    if (!this.noiseBuffer) return

    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.loop = false

    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 8000

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.12, time)
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.05)

    src.connect(filter)
    filter.connect(env)
    env.connect(this.percGain!)
    src.start(time)
    src.stop(time + 0.06)
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  setMusicIntensity(wave: number): void {
    if (!this.ctx || !this.musicGain) return
    const intensity = wave <= 2 ? 1 : wave <= 4 ? 2 : wave <= 6 ? 3 : wave <= 8 ? 4 : wave <= 10 ? 5 : 6
    if (intensity === this.currentIntensity) return
    this.currentIntensity = intensity

    const t = this.ctx.currentTime
    const ramp = 1.5

    const bassTarget = intensity >= 2 ? 0.6 : 0
    const arpTarget = intensity >= 3 ? 0.55 : 0
    const leadTarget = intensity >= 5 ? 0.45 : 0
    const percTarget = intensity >= 4 ? 0.5 : 0
    const musicTarget = intensity >= 6 ? 0.55 : 0.38

    this.bassGain?.gain.linearRampToValueAtTime(bassTarget, t + ramp)
    this.arpGain?.gain.linearRampToValueAtTime(arpTarget, t + ramp)
    this.leadGain?.gain.linearRampToValueAtTime(leadTarget, t + ramp)
    this.percGain?.gain.linearRampToValueAtTime(percTarget, t + ramp)
    if (!this.musicMuted) {
      this.musicGain.gain.linearRampToValueAtTime(musicTarget, t + ramp)
    }
  }

  playAttack(type: AttackSoundType): void {
    const ctx = this.ctx
    if (!ctx || !this.sfxGain) return

    const t = ctx.currentTime

    switch (type) {
      case 'light': {
        // Short bandpass noise burst
        if (!this.noiseBuffer) return
        const src = ctx.createBufferSource()
        src.buffer = this.noiseBuffer
        const filter = ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = 1000
        filter.Q.value = 4
        const env = ctx.createGain()
        env.gain.setValueAtTime(0.35, t)
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
        src.connect(filter)
        filter.connect(env)
        env.connect(this.sfxGain)
        src.start(t)
        src.stop(t + 0.1)
        // Pitch up "swish"
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(600, t)
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.06)
        const oscEnv = ctx.createGain()
        oscEnv.gain.setValueAtTime(0.08, t)
        oscEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
        osc.connect(oscEnv)
        oscEnv.connect(this.sfxGain)
        osc.start(t)
        osc.stop(t + 0.07)
        break
      }
      case 'heavy': {
        // Low sine sweep down + noise layer
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(90, t)
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.12)
        const env = ctx.createGain()
        env.gain.setValueAtTime(0.55, t)
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
        osc.connect(env)
        env.connect(this.sfxGain)
        osc.start(t)
        osc.stop(t + 0.28)
        // Noise layer
        if (this.noiseBuffer) {
          const src = ctx.createBufferSource()
          src.buffer = this.noiseBuffer
          const filter = ctx.createBiquadFilter()
          filter.type = 'lowpass'
          filter.frequency.value = 400
          const nEnv = ctx.createGain()
          nEnv.gain.setValueAtTime(0.3, t)
          nEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
          src.connect(filter)
          filter.connect(nEnv)
          nEnv.connect(this.sfxGain)
          src.start(t)
          src.stop(t + 0.22)
        }
        break
      }
      case 'pulse': {
        // Sine chord (220 + 440 + 880) with quick decay
        const freqs = [220, 440, 880]
        freqs.forEach((freq, i) => {
          const osc = ctx.createOscillator()
          osc.type = 'sine'
          osc.frequency.value = freq
          const env = ctx.createGain()
          const vol = i === 0 ? 0.22 : i === 1 ? 0.16 : 0.1
          env.gain.setValueAtTime(vol, t)
          env.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
          osc.connect(env)
          env.connect(this.sfxGain)
          osc.start(t)
          osc.stop(t + 0.38)
        })
        // Sub boom
        const sub = ctx.createOscillator()
        sub.type = 'sine'
        sub.frequency.setValueAtTime(55, t)
        sub.frequency.exponentialRampToValueAtTime(30, t + 0.15)
        const subEnv = ctx.createGain()
        subEnv.gain.setValueAtTime(0.4, t)
        subEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
        sub.connect(subEnv)
        subEnv.connect(this.sfxGain)
        sub.start(t)
        sub.stop(t + 0.22)
        break
      }
      case 'flicker': {
        // Pitch down + reverb sweep
        const osc = ctx.createOscillator()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(500, t)
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.2)
        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(2000, t)
        filter.frequency.exponentialRampToValueAtTime(200, t + 0.2)
        const env = ctx.createGain()
        env.gain.setValueAtTime(0.2, t)
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
        osc.connect(filter)
        filter.connect(env)
        env.connect(this.sfxGain)
        osc.start(t)
        osc.stop(t + 0.32)
        break
      }
    }
  }

  playHit(damage: number): void {
    const ctx = this.ctx
    if (!ctx || !this.sfxGain) return
    const t = ctx.currentTime

    // Low thud — severity scales with damage
    const vol = Math.min(0.55, 0.2 + damage * 0.015)
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(100, t)
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.07)

    const dist = ctx.createWaveShaper()
    const curve = new Float32Array(256)
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1
      curve[i] = (Math.PI + 200) * x / (Math.PI + 200 * Math.abs(x))
    }
    dist.curve = curve

    const env = ctx.createGain()
    env.gain.setValueAtTime(vol, t)
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.12)

    osc.connect(dist)
    dist.connect(env)
    env.connect(this.sfxGain)
    osc.start(t)
    osc.stop(t + 0.14)
  }

  playEnemyDeath(type: EnemyType): void {
    const ctx = this.ctx
    if (!ctx || !this.sfxGain) return
    const t = ctx.currentTime

    switch (type) {
      case 'normal': {
        // Pop at 600Hz
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(600, t)
        osc.frequency.exponentialRampToValueAtTime(200, t + 0.05)
        const env = ctx.createGain()
        env.gain.setValueAtTime(0.25, t)
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
        osc.connect(env)
        env.connect(this.sfxGain)
        osc.start(t)
        osc.stop(t + 0.12)
        break
      }
      case 'sniper': {
        // Glass-like chime 1200Hz
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = 1200
        const env = ctx.createGain()
        env.gain.setValueAtTime(0.22, t)
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
        osc.connect(env)
        env.connect(this.sfxGain)
        osc.start(t)
        osc.stop(t + 0.32)
        // Add harmonics for crystal feel
        ;[2400, 3600].forEach((freq, i) => {
          const h = ctx.createOscillator()
          h.type = 'sine'
          h.frequency.value = freq
          const hEnv = ctx.createGain()
          hEnv.gain.setValueAtTime(0.08 - i * 0.02, t)
          hEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
          h.connect(hEnv)
          hEnv.connect(this.sfxGain!)
          h.start(t)
          h.stop(t + 0.22)
        })
        break
      }
      case 'heavy': {
        // Deep boom 40Hz + rumble
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(60, t)
        osc.frequency.exponentialRampToValueAtTime(20, t + 0.18)
        const env = ctx.createGain()
        env.gain.setValueAtTime(0.65, t)
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
        osc.connect(env)
        env.connect(this.sfxGain)
        osc.start(t)
        osc.stop(t + 0.38)
        // Rumble noise
        if (this.noiseBuffer) {
          const src = ctx.createBufferSource()
          src.buffer = this.noiseBuffer
          const filter = ctx.createBiquadFilter()
          filter.type = 'lowpass'
          filter.frequency.value = 250
          const nEnv = ctx.createGain()
          nEnv.gain.setValueAtTime(0.22, t)
          nEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
          src.connect(filter)
          filter.connect(nEnv)
          nEnv.connect(this.sfxGain!)
          src.start(t)
          src.stop(t + 0.32)
        }
        break
      }
      case 'fast': {
        // Short whoosh noise (highpass)
        if (!this.noiseBuffer) break
        const src = ctx.createBufferSource()
        src.buffer = this.noiseBuffer
        const filter = ctx.createBiquadFilter()
        filter.type = 'highpass'
        filter.frequency.value = 3000
        const env = ctx.createGain()
        env.gain.setValueAtTime(0.28, t)
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
        src.connect(filter)
        filter.connect(env)
        env.connect(this.sfxGain)
        src.start(t)
        src.stop(t + 0.08)
        break
      }
    }
  }

  playLastStand(): void {
    const ctx = this.ctx
    if (!ctx || !this.sfxGain || !this.musicGain) return
    const t = ctx.currentTime

    // Duck music
    this.musicMuted = true
    this.musicGain.gain.linearRampToValueAtTime(0.08, t + 0.05)

    // Dramatic bass drop
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(80, t)
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.3)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.7, t)
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
    osc.connect(env)
    env.connect(this.sfxGain)
    osc.start(t)
    osc.stop(t + 0.65)

    // Heartbeat
    let beat = 0
    this.heartbeatHandle = setInterval(() => {
      if (!ctx || !this.sfxGain) return
      const bt = ctx.currentTime
      const bOsc = ctx.createOscillator()
      bOsc.type = 'sine'
      bOsc.frequency.setValueAtTime(beat % 2 === 0 ? 60 : 45, bt)
      bOsc.frequency.exponentialRampToValueAtTime(20, bt + 0.06)
      const bEnv = ctx.createGain()
      bEnv.gain.setValueAtTime(0.35, bt)
      bEnv.gain.exponentialRampToValueAtTime(0.001, bt + 0.1)
      bOsc.connect(bEnv)
      bEnv.connect(this.sfxGain)
      bOsc.start(bt)
      bOsc.stop(bt + 0.12)
      beat++
    }, 420) // ~72 BPM
  }

  resumeMusic(): void {
    const ctx = this.ctx
    if (!ctx || !this.musicGain) return
    this.musicMuted = false

    if (this.heartbeatHandle !== null) {
      clearInterval(this.heartbeatHandle)
      this.heartbeatHandle = null
    }

    // Fade music back in
    const target = this.currentIntensity >= 6 ? 0.55 : 0.38
    this.musicGain.gain.linearRampToValueAtTime(target, ctx.currentTime + 1.0)
  }

  playConsumable(type: 'nuke' | 'full_heal' | 'invincibility'): void {
    const ctx = this.ctx
    if (!ctx || !this.sfxGain) return
    const t = ctx.currentTime

    switch (type) {
      case 'nuke': {
        // Explosion sweep
        const osc = ctx.createOscillator()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(200, t)
        osc.frequency.exponentialRampToValueAtTime(25, t + 0.4)
        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(3000, t)
        filter.frequency.exponentialRampToValueAtTime(100, t + 0.4)
        const env = ctx.createGain()
        env.gain.setValueAtTime(0.65, t)
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
        osc.connect(filter)
        filter.connect(env)
        env.connect(this.sfxGain)
        osc.start(t)
        osc.stop(t + 0.55)
        break
      }
      case 'full_heal': {
        // Rising chime chord
        ;[523, 659, 784].forEach((freq, i) => {
          const osc = ctx.createOscillator()
          osc.type = 'sine'
          osc.frequency.value = freq
          const env = ctx.createGain()
          env.gain.setValueAtTime(0, t + i * 0.05)
          env.gain.linearRampToValueAtTime(0.18, t + i * 0.05 + 0.02)
          env.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
          osc.connect(env)
          env.connect(this.sfxGain!)
          osc.start(t + i * 0.05)
          osc.stop(t + 0.65)
        })
        break
      }
      case 'invincibility': {
        // Electric hum rising
        const osc = ctx.createOscillator()
        osc.type = 'square'
        osc.frequency.setValueAtTime(110, t)
        osc.frequency.exponentialRampToValueAtTime(440, t + 0.15)
        const filter = ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = 500
        filter.Q.value = 5
        const env = ctx.createGain()
        env.gain.setValueAtTime(0.12, t)
        env.gain.linearRampToValueAtTime(0.22, t + 0.1)
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
        osc.connect(filter)
        filter.connect(env)
        env.connect(this.sfxGain)
        osc.start(t)
        osc.stop(t + 0.42)
        break
      }
    }
  }

  // ─── New SFX ───────────────────────────────────────────────────────────────

  playDash(): void {
    const ctx = this.ctx
    if (!ctx || !this.sfxGain) return
    const t = ctx.currentTime
    // Short sawtooth swoosh: 800→200 Hz in 80ms
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(800, t)
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.08)
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 500
    filter.Q.value = 1.5
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.18, t)
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
    osc.connect(filter)
    filter.connect(env)
    env.connect(this.sfxGain)
    osc.start(t)
    osc.stop(t + 0.12)
  }

  playWaveStart(_wave: number): void {
    const ctx = this.ctx
    if (!ctx || !this.sfxGain) return
    const t = ctx.currentTime
    // 3-note ascending arpeggio: C4 → E4 → G4, 100ms each, bright sine
    const freqs = [NOTES.C4, 329.63, NOTES.G4] // C4, E4, G4
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      const env = ctx.createGain()
      const start = t + i * 0.1
      env.gain.setValueAtTime(0, start)
      env.gain.linearRampToValueAtTime(0.2, start + 0.02)
      env.gain.exponentialRampToValueAtTime(0.001, start + 0.12)
      osc.connect(env)
      env.connect(this.sfxGain!)
      osc.start(start)
      osc.stop(start + 0.14)
    })
  }

  playWaveEnd(): void {
    const ctx = this.ctx
    if (!ctx || !this.sfxGain) return
    const t = ctx.currentTime
    // 2-note descent (G4 → C4) + soft resolution chord
    const freqs = [NOTES.G4, NOTES.C4]
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      const env = ctx.createGain()
      const start = t + i * 0.14
      env.gain.setValueAtTime(0, start)
      env.gain.linearRampToValueAtTime(0.18, start + 0.02)
      env.gain.exponentialRampToValueAtTime(0.001, start + 0.22)
      osc.connect(env)
      env.connect(this.sfxGain!)
      osc.start(start)
      osc.stop(start + 0.25)
    })
    // Soft pad chord underneath
    ;[NOTES.C4, NOTES.Eb4, NOTES.G4].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = freq
      const env = ctx.createGain()
      env.gain.setValueAtTime(0, t + 0.1)
      env.gain.linearRampToValueAtTime(0.07 - i * 0.01, t + 0.2)
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.7)
      osc.connect(env)
      env.connect(this.sfxGain!)
      osc.start(t + 0.1)
      osc.stop(t + 0.75)
    })
  }

  playMutatorSelect(rarity: 'common' | 'rare' | 'epic'): void {
    const ctx = this.ctx
    if (!ctx || !this.sfxGain) return
    const t = ctx.currentTime
    if (rarity === 'common') {
      // Single bright chime at C5
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = NOTES.C5
      const env = ctx.createGain()
      env.gain.setValueAtTime(0.22, t)
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
      osc.connect(env)
      env.connect(this.sfxGain)
      osc.start(t)
      osc.stop(t + 0.28)
    } else if (rarity === 'rare') {
      // 2-note rise: G4 → C5
      ;[NOTES.G4, NOTES.C5].forEach((freq, i) => {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freq
        const env = ctx.createGain()
        const start = t + i * 0.1
        env.gain.setValueAtTime(0.2, start)
        env.gain.exponentialRampToValueAtTime(0.001, start + 0.2)
        osc.connect(env)
        env.connect(this.sfxGain!)
        osc.start(start)
        osc.stop(start + 0.22)
      })
    } else {
      // Epic: 3-note fanfare C4 → G4 → C5 with harmonics
      ;[NOTES.C4, NOTES.G4, NOTES.C5].forEach((freq, i) => {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freq
        const env = ctx.createGain()
        const start = t + i * 0.1
        env.gain.setValueAtTime(0.22, start)
        env.gain.exponentialRampToValueAtTime(0.001, start + 0.3)
        osc.connect(env)
        env.connect(this.sfxGain!)
        osc.start(start)
        osc.stop(start + 0.35)
        // Harmonic overtone
        const h = ctx.createOscillator()
        h.type = 'sine'
        h.frequency.value = freq * 2
        const hEnv = ctx.createGain()
        hEnv.gain.setValueAtTime(0.08, start)
        hEnv.gain.exponentialRampToValueAtTime(0.001, start + 0.2)
        h.connect(hEnv)
        hEnv.connect(this.sfxGain!)
        h.start(start)
        h.stop(start + 0.22)
      })
    }
  }

  playContractResult(accepted: boolean): void {
    const ctx = this.ctx
    if (!ctx || !this.sfxGain) return
    const t = ctx.currentTime
    if (accepted) {
      // Bright ping at 880 Hz
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, t)
      osc.frequency.linearRampToValueAtTime(1100, t + 0.05)
      const env = ctx.createGain()
      env.gain.setValueAtTime(0.2, t)
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
      osc.connect(env)
      env.connect(this.sfxGain)
      osc.start(t)
      osc.stop(t + 0.25)
    } else {
      // Low blip at 220 Hz, slightly distorted
      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.setValueAtTime(220, t)
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.1)
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 400
      const env = ctx.createGain()
      env.gain.setValueAtTime(0.15, t)
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
      osc.connect(filter)
      filter.connect(env)
      env.connect(this.sfxGain)
      osc.start(t)
      osc.stop(t + 0.18)
    }
  }

  playLevelUp(): void {
    const ctx = this.ctx
    if (!ctx || !this.sfxGain) return
    const t = ctx.currentTime
    // 4-note ascending melody: C4 → Eb4 → G4 → C5
    const melody = [NOTES.C4, NOTES.Eb4, NOTES.G4, NOTES.C5]
    melody.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      const env = ctx.createGain()
      const start = t + i * 0.1
      env.gain.setValueAtTime(0, start)
      env.gain.linearRampToValueAtTime(0.22, start + 0.02)
      env.gain.exponentialRampToValueAtTime(0.001, start + 0.25)
      osc.connect(env)
      env.connect(this.sfxGain!)
      osc.start(start)
      osc.stop(start + 0.28)
    })
  }

  stopMusic(): void {
    if (this.schedulerHandle !== null) {
      clearInterval(this.schedulerHandle)
      this.schedulerHandle = null
    }
    if (this.heartbeatHandle !== null) {
      clearInterval(this.heartbeatHandle)
      this.heartbeatHandle = null
    }
    const ctx = this.ctx
    if (ctx && this.musicGain) {
      this.musicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5)
    }
  }

  resume(): void {
    // Resume suspended AudioContext (required after user interaction in some browsers)
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume()
    }
  }
}

export const audio = new AudioEngine()
