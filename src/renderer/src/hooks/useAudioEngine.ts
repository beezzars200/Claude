import { useRef, useEffect, useCallback } from 'react'
import { useStore, Track } from '../store/useStore'
import { analyze } from 'web-audio-beat-detector'

function createReverbIR(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * duration)
  const ir = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const data = ir.getChannelData(c)
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
    }
  }
  return ir
}

interface DeckNodes {
  source: AudioBufferSourceNode | null
  buffer: AudioBuffer | null
  gainNode: GainNode
  eqLow: BiquadFilterNode
  eqMid: BiquadFilterNode
  eqHigh: BiquadFilterNode
  lpfNode: BiquadFilterNode
  hpfNode: BiquadFilterNode
  // Effects
  echoDelay: DelayNode
  echoFeedback: GainNode
  echoWet: GainNode
  reverbConvolver: ConvolverNode
  reverbWet: GainNode
  flangerDelay: DelayNode
  flangerLFO: OscillatorNode
  flangerLFOGain: GainNode
  flangerWet: GainNode
  outputGain: GainNode
  startTime: number
  startOffset: number
  isPlaying: boolean
  analyser: AnalyserNode
  playbackRate: number
  loopActive: boolean
  loopStart: number
  loopEnd: number
}

interface AudioEngineRef {
  context: AudioContext | null
  deckA: DeckNodes | null
  deckB: DeckNodes | null
  crossfaderGainA: GainNode | null
  crossfaderGainB: GainNode | null
  masterGain: GainNode | null
  recorderDest: MediaStreamAudioDestinationNode | null
  mediaRecorder: MediaRecorder | null
  recordingChunks: Blob[]
  animFrameId: number | null
}

function detectBeatPhase(buffer: AudioBuffer, bpm: number): number {
  if (bpm <= 0) return -1
  const sampleRate = buffer.sampleRate
  const data = buffer.getChannelData(0)
  // Analyze first 60s for more reliable bar detection
  const analyzeLen = Math.min(data.length, Math.floor(sampleRate * 60))

  const hop = Math.floor(sampleRate * 0.005)
  const frame = Math.floor(sampleRate * 0.023)
  const numFrames = Math.floor((analyzeLen - frame) / hop)
  if (numFrames < 100) return -1

  // Compute RMS energy per frame
  const energy = new Float32Array(numFrames)
  for (let i = 0; i < numFrames; i++) {
    const s = i * hop
    let e = 0
    for (let j = 0; j < frame; j++) e += data[s + j] * data[s + j]
    energy[i] = Math.sqrt(e / frame)
  }

  // Half-wave rectified onset strength
  const onset = new Float32Array(numFrames)
  for (let i = 1; i < numFrames; i++) {
    const d = energy[i] - energy[i - 1]
    onset[i] = d > 0 ? d : 0
  }

  const frameRate = sampleRate / hop
  const beatPeriod = Math.round(frameRate * 60 / bpm)
  if (beatPeriod < 1) return -1

  // Accumulate over a full bar period (4 beats) to find the DOWNBEAT.
  // Single-beat accumulation only finds "a beat" — bar accumulation finds
  // the highest-energy position within 4 beats, which is beat 1 (the kick/downbeat).
  const barPeriod = beatPeriod * 4
  const barBins = new Float32Array(barPeriod)
  for (let i = 0; i < numFrames; i++) {
    barBins[i % barPeriod] += onset[i]
  }

  // Best bar phase = argmax (= position of strongest onset in 4-beat cycle)
  let bestBar = 0
  let bestVal = 0
  for (let p = 0; p < barPeriod; p++) {
    if (barBins[p] > bestVal) { bestVal = barBins[p]; bestBar = p }
  }

  return (bestBar * hop) / sampleRate
}

function createDeckNodes(ctx: AudioContext, masterGain: GainNode, recorderDest: MediaStreamAudioDestinationNode): DeckNodes {
  const gainNode = ctx.createGain()
  const eqLow = ctx.createBiquadFilter()
  const eqMid = ctx.createBiquadFilter()
  const eqHigh = ctx.createBiquadFilter()
  const outputGain = ctx.createGain()
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 512
  analyser.minDecibels = -90      // silence → byte 0
  analyser.maxDecibels = 0        // 0 dBFS → byte 255  (was -30, causing everything to clip)
  analyser.smoothingTimeConstant = 0  // we handle smoothing ourselves in the VU animate loop

  eqLow.type = 'lowshelf'
  eqLow.frequency.value = 200
  eqLow.gain.value = 0

  eqMid.type = 'peaking'
  eqMid.frequency.value = 1000
  eqMid.Q.value = 0.5
  eqMid.gain.value = 0

  eqHigh.type = 'highshelf'
  eqHigh.frequency.value = 3000
  eqHigh.gain.value = 0

  // LP / HP filter nodes — start fully open (bypass)
  const lpfNode = ctx.createBiquadFilter()
  lpfNode.type = 'lowpass'
  lpfNode.frequency.value = 20000
  lpfNode.Q.value = 0.7

  const hpfNode = ctx.createBiquadFilter()
  hpfNode.type = 'highpass'
  hpfNode.frequency.value = 20
  hpfNode.Q.value = 0.7

  // Echo effect (parallel send/return to analyser)
  const echoDelay = ctx.createDelay(2.0)
  echoDelay.delayTime.value = 0.3
  const echoFeedback = ctx.createGain()
  echoFeedback.gain.value = 0.4
  const echoWet = ctx.createGain()
  echoWet.gain.value = 0  // off by default
  echoDelay.connect(echoFeedback)
  echoFeedback.connect(echoDelay)
  echoDelay.connect(echoWet)
  echoWet.connect(analyser)

  // Reverb effect
  const reverbConvolver = ctx.createConvolver()
  reverbConvolver.buffer = createReverbIR(ctx, 2, 3)
  const reverbWet = ctx.createGain()
  reverbWet.gain.value = 0  // off by default
  reverbConvolver.connect(reverbWet)
  reverbWet.connect(analyser)

  // Flanger effect
  const flangerDelay = ctx.createDelay(0.02)
  flangerDelay.delayTime.value = 0.003
  const flangerLFO = ctx.createOscillator()
  flangerLFO.type = 'sine'
  flangerLFO.frequency.value = 0.3
  const flangerLFOGain = ctx.createGain()
  flangerLFOGain.gain.value = 0.002
  flangerLFO.connect(flangerLFOGain)
  flangerLFOGain.connect(flangerDelay.delayTime)
  flangerLFO.start()
  const flangerWet = ctx.createGain()
  flangerWet.gain.value = 0  // off by default
  flangerDelay.connect(flangerWet)
  flangerWet.connect(analyser)

  // Signal chain: gain → EQ → HPF → LPF → analyser (dry) → output
  // Effects tap from lpfNode and return to analyser (parallel)
  gainNode.connect(eqLow)
  eqLow.connect(eqMid)
  eqMid.connect(eqHigh)
  eqHigh.connect(hpfNode)
  hpfNode.connect(lpfNode)
  lpfNode.connect(analyser)         // dry path
  lpfNode.connect(echoDelay)        // echo send
  lpfNode.connect(reverbConvolver)  // reverb send
  lpfNode.connect(flangerDelay)     // flanger send
  analyser.connect(outputGain)
  outputGain.connect(masterGain)
  outputGain.connect(recorderDest)

  return {
    source: null,
    buffer: null,
    gainNode,
    eqLow,
    eqMid,
    eqHigh,
    lpfNode,
    hpfNode,
    echoDelay,
    echoFeedback,
    echoWet,
    reverbConvolver,
    reverbWet,
    flangerDelay,
    flangerLFO,
    flangerLFOGain,
    flangerWet,
    outputGain,
    startTime: 0,
    startOffset: 0,
    isPlaying: false,
    analyser,
    playbackRate: 1.0,
    loopActive: false,
    loopStart: 0,
    loopEnd: 0
  }
}

export function useAudioEngine() {
  const engineRef = useRef<AudioEngineRef>({
    context: null,
    deckA: null,
    deckB: null,
    crossfaderGainA: null,
    crossfaderGainB: null,
    masterGain: null,
    recorderDest: null,
    mediaRecorder: null,
    recordingChunks: [],
    animFrameId: null
  })

  const {
    setDeckA,
    setDeckB,
    setCrossfader,
    setMasterVolume,
    setRecorder,
    deckA,
    deckB,
    crossfader,
    masterVolume,
    recorder
  } = useStore()

  const storeRef = useRef({ deckA, deckB, crossfader, masterVolume, recorder })
  storeRef.current = { deckA, deckB, crossfader, masterVolume, recorder }

  const initAudio = useCallback(() => {
    if (engineRef.current.context) return

    const ctx = new AudioContext({ sampleRate: 44100 })
    const masterGain = ctx.createGain()
    masterGain.gain.value = 0.8
    const recorderDest = ctx.createMediaStreamDestination()
    masterGain.connect(ctx.destination)
    masterGain.connect(recorderDest)

    const crossfaderGainA = ctx.createGain()
    const crossfaderGainB = ctx.createGain()

    const deckANodes = createDeckNodes(ctx, crossfaderGainA, recorderDest)
    const deckBNodes = createDeckNodes(ctx, crossfaderGainB, recorderDest)

    crossfaderGainA.connect(masterGain)
    crossfaderGainB.connect(masterGain)

    // Apply initial crossfader (0.5 = center)
    crossfaderGainA.gain.value = 1
    crossfaderGainB.gain.value = 1

    engineRef.current = {
      context: ctx,
      deckA: deckANodes,
      deckB: deckBNodes,
      crossfaderGainA,
      crossfaderGainB,
      masterGain,
      recorderDest,
      mediaRecorder: null,
      recordingChunks: [],
      animFrameId: null
    }

    startAnimationLoop()
  }, [])

  const startAnimationLoop = useCallback(() => {
    const eng = engineRef.current
    if (!eng.context) return

    const loop = () => {
      if (eng.deckA && eng.deckA.isPlaying && eng.context) {
        const elapsed = eng.context.currentTime - eng.deckA.startTime
        let currentTime = eng.deckA.startOffset + elapsed * eng.deckA.playbackRate
        if (eng.deckA.loopActive && eng.deckA.loopEnd > eng.deckA.loopStart && currentTime >= eng.deckA.loopEnd) {
          const loopLen = eng.deckA.loopEnd - eng.deckA.loopStart
          currentTime = eng.deckA.loopStart + ((currentTime - eng.deckA.loopStart) % loopLen)
        }
        currentTime = Math.min(currentTime, eng.deckA.buffer?.duration || 0)
        setDeckA({ currentTime })

        if (!eng.deckA.loopActive && eng.deckA.buffer && currentTime >= eng.deckA.buffer.duration) {
          eng.deckA.isPlaying = false
          setDeckA({ isPlaying: false, currentTime: eng.deckA.buffer.duration })
        }
      }

      if (eng.deckB && eng.deckB.isPlaying && eng.context) {
        const elapsed = eng.context.currentTime - eng.deckB.startTime
        let currentTime = eng.deckB.startOffset + elapsed * eng.deckB.playbackRate
        if (eng.deckB.loopActive && eng.deckB.loopEnd > eng.deckB.loopStart && currentTime >= eng.deckB.loopEnd) {
          const loopLen = eng.deckB.loopEnd - eng.deckB.loopStart
          currentTime = eng.deckB.loopStart + ((currentTime - eng.deckB.loopStart) % loopLen)
        }
        currentTime = Math.min(currentTime, eng.deckB.buffer?.duration || 0)
        setDeckB({ currentTime })

        if (!eng.deckB.loopActive && eng.deckB.buffer && currentTime >= eng.deckB.buffer.duration) {
          eng.deckB.isPlaying = false
          setDeckB({ isPlaying: false, currentTime: eng.deckB.buffer.duration })
        }
      }

      eng.animFrameId = requestAnimationFrame(loop)
    }

    eng.animFrameId = requestAnimationFrame(loop)
  }, [setDeckA, setDeckB])

  // Load track to deck
  const loadTrack = useCallback(
    async (deck: 'A' | 'B', fileUrl: string, trackName: string) => {
      initAudio()
      const eng = engineRef.current
      if (!eng.context) return

      const setter = deck === 'A' ? setDeckA : setDeckB

      try {
        // Fetch ID3 metadata first (fast — just reads tags, no audio decode)
        let artist: string | undefined
        let title: string | undefined
        let albumArt: string | null = null
        try {
          const meta = await window.api.getMetadata(fileUrl)
          artist = meta.artist ?? undefined
          title = meta.title ?? undefined
          albumArt = meta.albumArt ?? null
        } catch { /* ignore — metadata is optional */ }

        const displayName = title ? (artist ? `${artist} - ${title}` : title) : trackName

        // Record in session history
        useStore.getState().addToHistory({ filePath: fileUrl, name: displayName, artist, deck, loadedAt: Date.now() })

        // Update the track on the deck with proper name/metadata
        const currentDeck = deck === 'A' ? storeRef.current.deckA : storeRef.current.deckB
        const updatedTrack: Track = currentDeck.track
          ? { ...currentDeck.track, name: displayName, artist, title }
          : { id: fileUrl, name: displayName, filePath: fileUrl, fileUrl, artist, title }
        setter({ track: updatedTrack, albumArt })

        // Read and decode audio
        const arrayBuffer = await window.api.readAudioFile(fileUrl)
        const audioBuffer = await eng.context.decodeAudioData(arrayBuffer)

        const deckNodes = deck === 'A' ? eng.deckA : eng.deckB
        if (!deckNodes) return

        // Stop existing source
        if (deckNodes.source) {
          try { deckNodes.source.stop() } catch (_) {}
          deckNodes.source.disconnect()
          deckNodes.source = null
        }

        deckNodes.buffer = audioBuffer
        deckNodes.startOffset = 0
        deckNodes.isPlaying = false
        // Reset loop and rate state so new track starts clean
        deckNodes.loopActive = false
        deckNodes.loopStart = 0
        deckNodes.loopEnd = 0
        deckNodes.playbackRate = 1.0

        // Accurate BPM detection using onset-strength autocorrelation
        let bpm = 120
        try {
          bpm = Math.round(await analyze(audioBuffer))
        } catch {
          bpm = fallbackBPM(audioBuffer)
        }

        const beatPhase = detectBeatPhase(audioBuffer, bpm)

        const { waveform, waveformLF, waveformMF, waveformHF } = computeWaveformData(audioBuffer)

        setter({
          isLoaded: true,
          isPlaying: false,
          currentTime: 0,
          duration: audioBuffer.duration,
          bpm,
          beatPhase,
          pitch: 0.5,
          loopActive: false,
          loopStart: 0,
          loopEnd: 0,
          waveform,
          waveformLF,
          waveformMF,
          waveformHF
        })
      } catch (err) {
        console.error('Failed to load track:', err)
        setter({ isLoaded: false })
      }
    },
    [initAudio, setDeckA, setDeckB]
  )

  // Pre-render waveform amplitude + 3 frequency bands per bar.
  // O(n) — single pass per block, no nested loops (previous version had O(n²) inner loop).
  function computeWaveformData(buffer: AudioBuffer, numPoints = 800): {
    waveform: Float32Array; waveformLF: Float32Array; waveformMF: Float32Array; waveformHF: Float32Array
  } {
    const channelData = buffer.getChannelData(0)
    const total = channelData.length
    const blockSize = Math.max(1, Math.floor(total / numPoints))
    const waveform = new Float32Array(numPoints)
    const waveformLF = new Float32Array(numPoints)
    const waveformMF = new Float32Array(numPoints)
    const waveformHF = new Float32Array(numPoints)

    // Sparse step for LF approximation: sample every Nth sample within the block
    // instead of the old O(blockSize²) sliding window.
    const sparseStep = Math.max(1, Math.floor(blockSize / 16))

    for (let i = 0; i < numPoints; i++) {
      const start = i * blockSize
      const end = Math.min(start + blockSize, total)
      let sumAbs = 0, sumDiff = 0, sumSparse = 0, sparseCount = 0

      for (let j = start; j < end; j++) {
        const s = Math.abs(channelData[j])
        sumAbs += s
        if (j > start) sumDiff += Math.abs(channelData[j] - channelData[j - 1])
        if ((j - start) % sparseStep === 0) { sumSparse += s; sparseCount++ }
      }

      const n = end - start
      const avgAbs = sumAbs / n
      const avgDiff = n > 1 ? sumDiff / (n - 1) : 0
      const lfApprox = sparseCount > 0 ? sumSparse / sparseCount : avgAbs

      waveform[i] = avgAbs
      waveformLF[i] = lfApprox
      waveformHF[i] = Math.min(avgAbs, avgDiff * 0.5)
      waveformMF[i] = Math.max(0, avgAbs - lfApprox * 0.7 - avgDiff * 0.3)
    }

    const normalise = (arr: Float32Array) => {
      let max = 0
      for (let i = 0; i < arr.length; i++) if (arr[i] > max) max = arr[i]
      if (max > 0) for (let i = 0; i < arr.length; i++) arr[i] /= max
    }
    normalise(waveformLF)
    normalise(waveformMF)
    normalise(waveformHF)

    return { waveform, waveformLF, waveformMF, waveformHF }
  }

  // Fallback BPM detector using onset-strength autocorrelation (used if the library throws)
  function fallbackBPM(buffer: AudioBuffer): number {
    const sampleRate = buffer.sampleRate
    const data = buffer.getChannelData(0)
    const analyzeLen = Math.min(data.length, Math.floor(sampleRate * 60))

    // RMS energy in ~23ms frames, 5ms hops
    const hop = Math.floor(sampleRate * 0.005)
    const frame = Math.floor(sampleRate * 0.023)
    const numFrames = Math.floor((analyzeLen - frame) / hop)
    if (numFrames < 100) return 120

    const energy = new Float32Array(numFrames)
    for (let i = 0; i < numFrames; i++) {
      const s = i * hop
      let e = 0
      for (let j = 0; j < frame; j++) e += data[s + j] * data[s + j]
      energy[i] = Math.sqrt(e / frame)
    }

    // Half-wave rectified first derivative = onset strength
    const onset = new Float32Array(numFrames)
    for (let i = 1; i < numFrames; i++) {
      const d = energy[i] - energy[i - 1]
      onset[i] = d > 0 ? d : 0
    }

    // Autocorrelation across BPM range 60–200
    const frameRate = sampleRate / hop
    const minLag = Math.round(frameRate * 60 / 200)
    const maxLag = Math.round(frameRate * 60 / 60)
    const N = Math.min(numFrames, 6000)

    let bestLag = minLag, bestVal = 0
    for (let lag = minLag; lag <= maxLag; lag++) {
      let sum = 0
      for (let i = 0; i < N - lag; i++) sum += onset[i] * onset[i + lag]
      const val = sum / (N - lag)
      if (val > bestVal) { bestVal = val; bestLag = lag }
    }

    let bpm = (frameRate * 60) / bestLag
    while (bpm < 70) bpm *= 2
    while (bpm > 175) bpm /= 2
    return Math.round(bpm)
  }

  const playDeck = useCallback(
    (deck: 'A' | 'B') => {
      const eng = engineRef.current
      if (!eng.context) return

      const deckNodes = deck === 'A' ? eng.deckA : eng.deckB
      if (!deckNodes || !deckNodes.buffer) return

      if (deckNodes.isPlaying) return

      // Create new source
      const source = eng.context.createBufferSource()
      source.buffer = deckNodes.buffer
      source.connect(deckNodes.gainNode)
      source.playbackRate.value = deckNodes.playbackRate

      if (deckNodes.loopActive && deckNodes.loopEnd > deckNodes.loopStart) {
        source.loop = true
        source.loopStart = deckNodes.loopStart
        source.loopEnd = deckNodes.loopEnd
        // Clamp startOffset into loop range
        if (deckNodes.startOffset < deckNodes.loopStart || deckNodes.startOffset >= deckNodes.loopEnd) {
          deckNodes.startOffset = deckNodes.loopStart
        }
      }

      const offset = Math.min(deckNodes.startOffset, deckNodes.buffer.duration - 0.01)
      source.start(0, offset)

      deckNodes.source = source
      deckNodes.startTime = eng.context.currentTime
      deckNodes.isPlaying = true

      const setter = deck === 'A' ? setDeckA : setDeckB
      setter({ isPlaying: true })
    },
    [setDeckA, setDeckB]
  )

  const pauseDeck = useCallback(
    (deck: 'A' | 'B') => {
      const eng = engineRef.current
      if (!eng.context) return

      const deckNodes = deck === 'A' ? eng.deckA : eng.deckB
      if (!deckNodes || !deckNodes.isPlaying) return

      const elapsed = eng.context.currentTime - deckNodes.startTime
      deckNodes.startOffset = Math.min(
        deckNodes.startOffset + elapsed * deckNodes.playbackRate,
        deckNodes.buffer?.duration || 0
      )

      if (deckNodes.source) {
        try { deckNodes.source.stop() } catch (_) {}
        deckNodes.source.disconnect()
        deckNodes.source = null
      }

      deckNodes.isPlaying = false

      const setter = deck === 'A' ? setDeckA : setDeckB
      setter({ isPlaying: false, currentTime: deckNodes.startOffset })
    },
    [setDeckA, setDeckB]
  )

  const cueDeck = useCallback(
    (deck: 'A' | 'B') => {
      const eng = engineRef.current
      const deckNodes = deck === 'A' ? eng.deckA : eng.deckB
      if (!deckNodes) return

      // Stop if playing
      if (deckNodes.isPlaying) {
        pauseDeck(deck)
      }

      // Reset to beginning
      deckNodes.startOffset = 0

      const setter = deck === 'A' ? setDeckA : setDeckB
      setter({ currentTime: 0, isPlaying: false })
    },
    [pauseDeck, setDeckA, setDeckB]
  )

  const setDeckVolume = useCallback((deck: 'A' | 'B', volume: number) => {
    const eng = engineRef.current
    const deckNodes = deck === 'A' ? eng.deckA : eng.deckB
    if (!deckNodes) return
    deckNodes.gainNode.gain.value = volume
    const setter = deck === 'A' ? setDeckA : setDeckB
    setter({ volume })
  }, [setDeckA, setDeckB])

  // Pitch: value 0–1 where 0.5 = normal speed, 0 = -16%, 1 = +16%
  const setPitch = useCallback((deck: 'A' | 'B', value: number) => {
    const eng = engineRef.current
    const deckNodes = deck === 'A' ? eng.deckA : eng.deckB
    if (!deckNodes) return
    const rate = 1.0 + (value - 0.5) * 0.32
    deckNodes.playbackRate = rate
    if (deckNodes.source) deckNodes.source.playbackRate.value = rate
    const setter = deck === 'A' ? setDeckA : setDeckB
    setter({ pitch: value })
  }, [setDeckA, setDeckB])

  const syncDeck = useCallback((deck: 'A' | 'B') => {
    const eng = engineRef.current
    const myState = deck === 'A' ? storeRef.current.deckA : storeRef.current.deckB
    const otherState = deck === 'A' ? storeRef.current.deckB : storeRef.current.deckA
    if (!myState.bpm || !otherState.bpm) return

    const otherEffectiveBPM = otherState.bpm * (1.0 + (otherState.pitch - 0.5) * 0.32)
    const requiredRate = otherEffectiveBPM / myState.bpm
    const clampedRate = Math.max(0.84, Math.min(1.16, requiredRate))
    const pitchValue = Math.max(0, Math.min(1, (clampedRate - 1.0) / 0.32 + 0.5))

    const deckNodes = deck === 'A' ? eng.deckA : eng.deckB
    if (!deckNodes) return
    deckNodes.playbackRate = clampedRate
    if (deckNodes.source) deckNodes.source.playbackRate.value = clampedRate

    const setter = deck === 'A' ? setDeckA : setDeckB
    setter({ pitch: pitchValue })
  }, [setDeckA, setDeckB])

  const nudgeDeck = useCallback((deck: 'A' | 'B', direction: 1 | -1) => {
    const eng = engineRef.current
    const deckNodes = deck === 'A' ? eng.deckA : eng.deckB
    if (!deckNodes || !deckNodes.isPlaying || !deckNodes.source) return
    deckNodes.source.playbackRate.value = deckNodes.playbackRate + direction * 0.08
  }, [])

  const stopNudge = useCallback((deck: 'A' | 'B') => {
    const eng = engineRef.current
    const deckNodes = deck === 'A' ? eng.deckA : eng.deckB
    if (!deckNodes || !deckNodes.source) return
    deckNodes.source.playbackRate.value = deckNodes.playbackRate
  }, [])

  const setEQ = useCallback(
    (deck: 'A' | 'B', band: 'low' | 'mid' | 'high', value: number) => {
      const eng = engineRef.current
      const deckNodes = deck === 'A' ? eng.deckA : eng.deckB
      if (!deckNodes) return

      const gainDb = (value - 0.5) * 24 // -12 to +12 dB

      if (band === 'low') {
        deckNodes.eqLow.gain.value = gainDb
        const setter = deck === 'A' ? setDeckA : setDeckB
        setter({ eqLow: value })
      } else if (band === 'mid') {
        deckNodes.eqMid.gain.value = gainDb
        const setter = deck === 'A' ? setDeckA : setDeckB
        setter({ eqMid: value })
      } else {
        deckNodes.eqHigh.gain.value = gainDb
        const setter = deck === 'A' ? setDeckA : setDeckB
        setter({ eqHigh: value })
      }
    },
    [setDeckA, setDeckB]
  )

  // LP filter: value 0 = bypass (20 kHz), value 1 = fully filtered (~200 Hz)
  // HP filter: value 0 = bypass (20 Hz),   value 1 = fully filtered (~8 kHz)
  const setFilter = useCallback((deck: 'A' | 'B', type: 'lp' | 'hp', value: number) => {
    const eng = engineRef.current
    const deckNodes = deck === 'A' ? eng.deckA : eng.deckB
    if (!deckNodes) return
    if (type === 'lp') {
      deckNodes.lpfNode.frequency.value = value < 0.02
        ? 20000
        : 20000 * Math.pow(200 / 20000, value)
    } else {
      deckNodes.hpfNode.frequency.value = value < 0.02
        ? 20
        : 20 * Math.pow(400, value)
    }
  }, [])

  // Echo: time 0–1 → 0.05–0.8s, feedback 0–1 → 0–0.85, wet 0–1
  const setEcho = useCallback((deck: 'A' | 'B', params: { time?: number; feedback?: number; wet?: number }) => {
    const deckNodes = (deck === 'A' ? engineRef.current.deckA : engineRef.current.deckB)
    if (!deckNodes) return
    if (params.time !== undefined) deckNodes.echoDelay.delayTime.value = 0.05 + params.time * 0.75
    if (params.feedback !== undefined) deckNodes.echoFeedback.gain.value = params.feedback * 0.85
    if (params.wet !== undefined) deckNodes.echoWet.gain.value = params.wet
  }, [])

  // Reverb: size 0–1 → short→long room, wet 0–1
  const setReverb = useCallback((deck: 'A' | 'B', params: { size?: number; wet?: number }) => {
    const eng = engineRef.current
    const deckNodes = deck === 'A' ? eng.deckA : eng.deckB
    if (!deckNodes || !eng.context) return
    if (params.size !== undefined) {
      deckNodes.reverbConvolver.buffer = createReverbIR(eng.context, 0.5 + params.size * 4, 1 + params.size * 5)
    }
    if (params.wet !== undefined) deckNodes.reverbWet.gain.value = params.wet
  }, [])

  // Flanger: rate 0–1 → 0.05–8 Hz, depth 0–1 → modulation depth, wet 0–1
  const setFlanger = useCallback((deck: 'A' | 'B', params: { rate?: number; depth?: number; wet?: number }) => {
    const deckNodes = (deck === 'A' ? engineRef.current.deckA : engineRef.current.deckB)
    if (!deckNodes) return
    if (params.rate !== undefined) deckNodes.flangerLFO.frequency.value = 0.05 + params.rate * 7.95
    if (params.depth !== undefined) deckNodes.flangerLFOGain.gain.value = params.depth * 0.004
    if (params.wet !== undefined) deckNodes.flangerWet.gain.value = params.wet
  }, [])

  // Helper: get current playback position accounting for loop wrapping
  const getCurrentTime = useCallback((deck: 'A' | 'B'): number => {
    const eng = engineRef.current
    const deckNodes = deck === 'A' ? eng.deckA : eng.deckB
    if (!deckNodes || !eng.context) return 0
    if (!deckNodes.isPlaying) return deckNodes.startOffset
    const elapsed = eng.context.currentTime - deckNodes.startTime
    let t = deckNodes.startOffset + elapsed * deckNodes.playbackRate
    if (deckNodes.loopActive && deckNodes.loopEnd > deckNodes.loopStart) {
      const loopLen = deckNodes.loopEnd - deckNodes.loopStart
      if (t >= deckNodes.loopEnd) {
        t = deckNodes.loopStart + ((t - deckNodes.loopStart) % loopLen)
      }
    }
    return t
  }, [])

  // Beat sync: match BPM then align beat phase between decks
  const beatSync = useCallback((deck: 'A' | 'B') => {
    const eng = engineRef.current
    const myState = deck === 'A' ? storeRef.current.deckA : storeRef.current.deckB
    const otherState = deck === 'A' ? storeRef.current.deckB : storeRef.current.deckA
    if (!myState.bpm || !otherState.bpm) return

    // Step 1: BPM sync
    const otherEffectiveBPM = otherState.bpm * (1.0 + (otherState.pitch - 0.5) * 0.32)
    const requiredRate = otherEffectiveBPM / myState.bpm
    const clampedRate = Math.max(0.84, Math.min(1.16, requiredRate))
    const pitchValue = Math.max(0, Math.min(1, (clampedRate - 1.0) / 0.32 + 0.5))
    const deckNodes = deck === 'A' ? eng.deckA : eng.deckB
    if (!deckNodes) return
    deckNodes.playbackRate = clampedRate
    if (deckNodes.source) deckNodes.source.playbackRate.value = clampedRate
    const setter = deck === 'A' ? setDeckA : setDeckB
    setter({ pitch: pitchValue })

    // Step 2: Phase alignment — only if both grids are valid and other deck is playing
    if (myState.beatPhase < 0 || otherState.beatPhase < 0 || !otherState.isPlaying) return
    const otherDeckNodes = deck === 'A' ? eng.deckB : eng.deckA
    if (!otherDeckNodes || !eng.context) return

    const otherElapsed = eng.context.currentTime - otherDeckNodes.startTime
    const otherCurrentTime = otherDeckNodes.isPlaying
      ? otherDeckNodes.startOffset + otherElapsed * otherDeckNodes.playbackRate
      : otherDeckNodes.startOffset
    const otherBeatInterval = 60 / otherEffectiveBPM
    const otherPhaseOffset = ((otherCurrentTime - otherState.beatPhase) % otherBeatInterval + otherBeatInterval) % otherBeatInterval

    const myCurrentTime = getCurrentTime(deck)
    const myBeatInterval = 60 / (myState.bpm * clampedRate)
    // Convert other deck's phase to a fraction (0..1) then to my beat interval
    const otherPhaseFrac = otherPhaseOffset / otherBeatInterval
    const targetPhaseInBeat = otherPhaseFrac * myBeatInterval
    // Find nearest beat grid position k such that (beatPhase + k*interval + targetPhaseInBeat) ≈ myCurrentTime
    const k = Math.round((myCurrentTime - myState.beatPhase - targetPhaseInBeat) / myBeatInterval)
    const targetTime = myState.beatPhase + k * myBeatInterval + targetPhaseInBeat

    const wasPlaying = deckNodes.isPlaying
    if (wasPlaying) {
      const elapsed = eng.context.currentTime - deckNodes.startTime
      deckNodes.startOffset = Math.min(deckNodes.startOffset + elapsed * deckNodes.playbackRate, deckNodes.buffer?.duration || 0)
      if (deckNodes.source) { try { deckNodes.source.stop() } catch (_) {}; deckNodes.source.disconnect(); deckNodes.source = null }
      deckNodes.isPlaying = false
    }
    const clamped = Math.max(0, Math.min(targetTime, deckNodes.buffer?.duration ?? 0))
    deckNodes.startOffset = clamped
    setter({ currentTime: clamped })
    if (wasPlaying) playDeck(deck)
  }, [getCurrentTime, playDeck, setDeckA, setDeckB])

  // Set loop in point at current playback position
  const setLoopIn = useCallback((deck: 'A' | 'B') => {
    const deckNodes = deck === 'A' ? engineRef.current.deckA : engineRef.current.deckB
    if (!deckNodes) return
    const t = getCurrentTime(deck)
    deckNodes.loopStart = t
    if (deckNodes.loopEnd <= t) deckNodes.loopEnd = 0
    const setter = deck === 'A' ? setDeckA : setDeckB
    setter({ loopStart: t })
  }, [getCurrentTime, setDeckA, setDeckB])

  // Set loop out point at current position and activate loop
  const setLoopOut = useCallback((deck: 'A' | 'B') => {
    const deckNodes = deck === 'A' ? engineRef.current.deckA : engineRef.current.deckB
    if (!deckNodes || !deckNodes.buffer) return
    const t = getCurrentTime(deck)
    if (t <= deckNodes.loopStart) return
    deckNodes.loopEnd = t
    deckNodes.loopActive = true
    if (deckNodes.source) {
      deckNodes.source.loop = true
      deckNodes.source.loopStart = deckNodes.loopStart
      deckNodes.source.loopEnd = t
    }
    const setter = deck === 'A' ? setDeckA : setDeckB
    setter({ loopEnd: t, loopActive: true })
  }, [getCurrentTime, setDeckA, setDeckB])

  // Toggle loop on/off (preserves loop points)
  // Anchor startOffset/startTime to the actual modulo position within the loop.
  // Call this BEFORE disabling loopActive so the tracker doesn't jump.
  const anchorLoopPosition = (deck: 'A' | 'B') => {
    const eng = engineRef.current
    const deckNodes = deck === 'A' ? eng.deckA : eng.deckB
    if (!deckNodes || !deckNodes.isPlaying || !eng.context) return
    if (deckNodes.loopEnd <= deckNodes.loopStart) return
    const elapsed = eng.context.currentTime - deckNodes.startTime
    const rawTime = deckNodes.startOffset + elapsed * deckNodes.playbackRate
    const loopLen = deckNodes.loopEnd - deckNodes.loopStart
    // Wrap into loop range (same logic as the animation loop)
    const actualPos = deckNodes.loopStart + ((rawTime - deckNodes.loopStart) % loopLen + loopLen) % loopLen
    deckNodes.startOffset = actualPos
    deckNodes.startTime = eng.context.currentTime
  }

  const toggleLoop = useCallback((deck: 'A' | 'B') => {
    const eng = engineRef.current
    const deckNodes = deck === 'A' ? eng.deckA : eng.deckB
    if (!deckNodes || !deckNodes.buffer || deckNodes.loopEnd <= deckNodes.loopStart) return
    const next = !deckNodes.loopActive
    if (!next) {
      // Deactivating — anchor time ref at actual modulo position so playback continues correctly
      anchorLoopPosition(deck)
    }
    deckNodes.loopActive = next
    if (deckNodes.source) {
      deckNodes.source.loop = next
      if (next) {
        deckNodes.source.loopStart = deckNodes.loopStart
        deckNodes.source.loopEnd = deckNodes.loopEnd
      }
    }
    const setter = deck === 'A' ? setDeckA : setDeckB
    setter({ loopActive: next })
  }, [setDeckA, setDeckB])

  // Exit loop — disable loop and continue playing from current loop position
  const exitLoop = useCallback((deck: 'A' | 'B') => {
    const deckNodes = deck === 'A' ? engineRef.current.deckA : engineRef.current.deckB
    if (!deckNodes) return
    anchorLoopPosition(deck)
    deckNodes.loopActive = false
    if (deckNodes.source) deckNodes.source.loop = false
    const setter = deck === 'A' ? setDeckA : setDeckB
    setter({ loopActive: false })
  }, [setDeckA, setDeckB])

  // Set beat loop: beats = number of beats (0.5=1/8 bar, 1=1/4, 2=1/2, 4=1, 8=2 bars etc.)
  const setBeatLoop = useCallback((deck: 'A' | 'B', beats: number) => {
    const eng = engineRef.current
    const deckNodes = deck === 'A' ? eng.deckA : eng.deckB
    const deckStateVal = deck === 'A' ? storeRef.current.deckA : storeRef.current.deckB
    if (!deckNodes || !deckNodes.buffer) return

    const effectiveBPM = deckStateVal.bpm > 0
      ? deckStateVal.bpm * (1.0 + (deckStateVal.pitch - 0.5) * 0.32)
      : 120
    const loopDuration = beats * (60 / effectiveBPM)
    const currentT = getCurrentTime(deck)
    let loopStart = currentT
    if (deckStateVal.bpm > 0 && deckStateVal.beatPhase >= 0) {
      const beatInterval = 60 / effectiveBPM
      const beatsFromPhase = (currentT - deckStateVal.beatPhase) / beatInterval
      const nearestBeat = Math.round(beatsFromPhase)
      const snapped = deckStateVal.beatPhase + nearestBeat * beatInterval
      if (Math.abs(snapped - currentT) <= beatInterval * 0.5) {
        loopStart = Math.max(0, snapped)
      }
    }
    const loopEnd = Math.min(loopStart + loopDuration, deckNodes.buffer.duration)

    deckNodes.loopStart = loopStart
    deckNodes.loopEnd = loopEnd
    deckNodes.loopActive = true

    // Stop current source and restart from loopStart with loop enabled
    const wasPlaying = deckNodes.isPlaying
    if (deckNodes.source) {
      try { deckNodes.source.stop() } catch (_) {}
      deckNodes.source.disconnect()
      deckNodes.source = null
    }
    deckNodes.isPlaying = false
    deckNodes.startOffset = loopStart

    const setter = deck === 'A' ? setDeckA : setDeckB
    setter({ loopActive: true, loopStart, loopEnd, currentTime: loopStart })

    if (wasPlaying) playDeck(deck)
  }, [getCurrentTime, playDeck, setDeckA, setDeckB])

  // Halve the loop length
  const loopHalve = useCallback((deck: 'A' | 'B') => {
    const deckNodes = deck === 'A' ? engineRef.current.deckA : engineRef.current.deckB
    if (!deckNodes || deckNodes.loopEnd <= deckNodes.loopStart) return
    const newEnd = deckNodes.loopStart + (deckNodes.loopEnd - deckNodes.loopStart) / 2
    deckNodes.loopEnd = newEnd
    if (deckNodes.source) deckNodes.source.loopEnd = newEnd
    const setter = deck === 'A' ? setDeckA : setDeckB
    setter({ loopEnd: newEnd })
  }, [setDeckA, setDeckB])

  // Double the loop length
  const loopDouble = useCallback((deck: 'A' | 'B') => {
    const deckNodes = deck === 'A' ? engineRef.current.deckA : engineRef.current.deckB
    if (!deckNodes || !deckNodes.buffer || deckNodes.loopEnd <= deckNodes.loopStart) return
    const newEnd = Math.min(
      deckNodes.loopStart + (deckNodes.loopEnd - deckNodes.loopStart) * 2,
      deckNodes.buffer.duration
    )
    deckNodes.loopEnd = newEnd
    if (deckNodes.source) deckNodes.source.loopEnd = newEnd
    const setter = deck === 'A' ? setDeckA : setDeckB
    setter({ loopEnd: newEnd })
  }, [setDeckA, setDeckB])

  // Reloop: jump back to loop start and re-enable loop
  const reloop = useCallback((deck: 'A' | 'B') => {
    const deckNodes = deck === 'A' ? engineRef.current.deckA : engineRef.current.deckB
    if (!deckNodes || !deckNodes.buffer || deckNodes.loopEnd <= deckNodes.loopStart) return
    const wasPlaying = deckNodes.isPlaying
    if (deckNodes.source) {
      try { deckNodes.source.stop() } catch (_) {}
      deckNodes.source.disconnect()
      deckNodes.source = null
    }
    deckNodes.isPlaying = false
    deckNodes.loopActive = true
    deckNodes.startOffset = deckNodes.loopStart
    const setter = deck === 'A' ? setDeckA : setDeckB
    setter({ loopActive: true, currentTime: deckNodes.loopStart })
    if (wasPlaying) playDeck(deck)
  }, [playDeck, setDeckA, setDeckB])

  // Analyze a file's BPM (used by Library for background caching)
  const analyzeTrackBPM = useCallback(async (filePath: string): Promise<number> => {
    try {
      if (!engineRef.current.context) initAudio()
      const ctx = engineRef.current.context
      if (!ctx) return 0
      const arrayBuffer = await window.api.readAudioFile(filePath)
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      return Math.round(await analyze(audioBuffer))
    } catch {
      return 0
    }
  }, [initAudio])

  const updateCrossfader = useCallback(
    (value: number) => {
      const eng = engineRef.current
      if (!eng.crossfaderGainA || !eng.crossfaderGainB) return

      // Equal power crossfade
      const angle = value * (Math.PI / 2)
      const gainA = Math.cos(angle)
      const gainB = Math.sin(angle)

      eng.crossfaderGainA.gain.value = gainA
      eng.crossfaderGainB.gain.value = gainB

      setCrossfader(value)
    },
    [setCrossfader]
  )

  const updateMasterVolume = useCallback(
    (value: number) => {
      const eng = engineRef.current
      if (!eng.masterGain) return
      eng.masterGain.gain.value = value
      setMasterVolume(value)
    },
    [setMasterVolume]
  )

  const seekDeck = useCallback(
    (deck: 'A' | 'B', time: number) => {
      const eng = engineRef.current
      const deckNodes = deck === 'A' ? eng.deckA : eng.deckB
      if (!deckNodes || !deckNodes.buffer) return

      const wasPlaying = deckNodes.isPlaying
      if (wasPlaying) pauseDeck(deck)

      deckNodes.startOffset = Math.max(0, Math.min(time, deckNodes.buffer.duration))
      const setter = deck === 'A' ? setDeckA : setDeckB
      setter({ currentTime: deckNodes.startOffset })

      if (wasPlaying) playDeck(deck)
    },
    [pauseDeck, playDeck, setDeckA, setDeckB]
  )

  const startRecording = useCallback(() => {
    const eng = engineRef.current
    if (!eng.recorderDest || !eng.context) return

    initAudio()

    const chunks: Blob[] = []
    eng.recordingChunks = chunks

    const mediaRecorder = new MediaRecorder(eng.recorderDest.stream, {
      mimeType: 'audio/webm;codecs=opus'
    })

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    mediaRecorder.start(100)
    eng.mediaRecorder = mediaRecorder

    setRecorder({ isRecording: true, recordingTime: 0, hasRecording: false, recordingBlob: null })
  }, [initAudio, setRecorder])

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const eng = engineRef.current
      if (!eng.mediaRecorder) {
        resolve(null)
        return
      }

      eng.mediaRecorder.onstop = () => {
        const blob = new Blob(eng.recordingChunks, { type: 'audio/webm' })
        setRecorder({ isRecording: false, hasRecording: true, recordingBlob: blob })
        resolve(blob)
      }

      eng.mediaRecorder.stop()
      eng.mediaRecorder = null
    })
  }, [setRecorder])

  const getAnalyserData = useCallback((deck: 'A' | 'B'): Uint8Array | null => {
    const eng = engineRef.current
    const deckNodes = deck === 'A' ? eng.deckA : eng.deckB
    if (!deckNodes) return null

    const data = new Uint8Array(deckNodes.analyser.frequencyBinCount)
    deckNodes.analyser.getByteFrequencyData(data)
    return data
  }, [])

  const getWaveformData = useCallback((deck: 'A' | 'B'): Uint8Array | null => {
    const eng = engineRef.current
    const deckNodes = deck === 'A' ? eng.deckA : eng.deckB
    if (!deckNodes) return null

    const data = new Uint8Array(deckNodes.analyser.fftSize)
    deckNodes.analyser.getByteTimeDomainData(data)
    return data
  }, [])

  useEffect(() => {
    return () => {
      const eng = engineRef.current
      if (eng.animFrameId) cancelAnimationFrame(eng.animFrameId)
      if (eng.context) eng.context.close()
    }
  }, [])

  return {
    initAudio,
    loadTrack,
    playDeck,
    pauseDeck,
    cueDeck,
    setDeckVolume,
    setPitch,
    syncDeck,
    nudgeDeck,
    stopNudge,
    setEQ,
    setFilter,
    setEcho,
    setReverb,
    setFlanger,
    analyzeTrackBPM,
    updateCrossfader,
    updateMasterVolume,
    seekDeck,
    startRecording,
    stopRecording,
    getAnalyserData,
    getWaveformData,
    setLoopIn,
    setLoopOut,
    toggleLoop,
    exitLoop,
    setBeatLoop,
    loopHalve,
    loopDouble,
    reloop,
    beatSync
  }
}
