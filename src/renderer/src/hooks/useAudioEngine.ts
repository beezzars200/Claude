import { useRef, useEffect, useCallback } from 'react'
import { useStore } from '../store/useStore'

interface DeckNodes {
  source: AudioBufferSourceNode | null
  buffer: AudioBuffer | null
  gainNode: GainNode
  eqLow: BiquadFilterNode
  eqMid: BiquadFilterNode
  eqHigh: BiquadFilterNode
  outputGain: GainNode
  startTime: number
  startOffset: number
  isPlaying: boolean
  analyser: AnalyserNode
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

function createDeckNodes(ctx: AudioContext, masterGain: GainNode, recorderDest: MediaStreamAudioDestinationNode): DeckNodes {
  const gainNode = ctx.createGain()
  const eqLow = ctx.createBiquadFilter()
  const eqMid = ctx.createBiquadFilter()
  const eqHigh = ctx.createBiquadFilter()
  const outputGain = ctx.createGain()
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 512

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

  gainNode.connect(eqLow)
  eqLow.connect(eqMid)
  eqMid.connect(eqHigh)
  eqHigh.connect(analyser)
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
    outputGain,
    startTime: 0,
    startOffset: 0,
    isPlaying: false,
    analyser
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
      const { deckA: deckAState, deckB: deckBState } = storeRef.current

      if (eng.deckA && eng.deckA.isPlaying && eng.context) {
        const elapsed = eng.context.currentTime - eng.deckA.startTime
        const currentTime = Math.min(eng.deckA.startOffset + elapsed, eng.deckA.buffer?.duration || 0)
        setDeckA({ currentTime })

        if (eng.deckA.buffer && currentTime >= eng.deckA.buffer.duration) {
          eng.deckA.isPlaying = false
          setDeckA({ isPlaying: false, currentTime: eng.deckA.buffer.duration })
        }
      }

      if (eng.deckB && eng.deckB.isPlaying && eng.context) {
        const elapsed = eng.context.currentTime - eng.deckB.startTime
        const currentTime = Math.min(eng.deckB.startOffset + elapsed, eng.deckB.buffer?.duration || 0)
        setDeckB({ currentTime })

        if (eng.deckB.buffer && currentTime >= eng.deckB.buffer.duration) {
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

      try {
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

        // Estimate BPM (simple approximation)
        const bpm = estimateBPM(audioBuffer)

        // Pre-render waveform + frequency coloring
        const { waveform, waveformLF, waveformMF, waveformHF } = computeWaveformData(audioBuffer)

        const setter = deck === 'A' ? setDeckA : setDeckB
        setter({
          isLoaded: true,
          isPlaying: false,
          currentTime: 0,
          duration: audioBuffer.duration,
          bpm,
          waveform,
          waveformLF,
          waveformMF,
          waveformHF
        })
      } catch (err) {
        console.error('Failed to load track:', err)
      }
    },
    [initAudio, setDeckA, setDeckB]
  )

  // Pre-render waveform amplitude + 3 frequency bands per bar
  function computeWaveformData(buffer: AudioBuffer, numPoints: number = 800): {
    waveform: Float32Array; waveformLF: Float32Array; waveformMF: Float32Array; waveformHF: Float32Array
  } {
    const channelData = buffer.getChannelData(0)
    const blockSize = Math.floor(channelData.length / numPoints)
    const waveform = new Float32Array(numPoints)
    const waveformLF = new Float32Array(numPoints)
    const waveformMF = new Float32Array(numPoints)
    const waveformHF = new Float32Array(numPoints)

    for (let i = 0; i < numPoints; i++) {
      const offset = i * blockSize
      let totalE = 0, diffE = 0, slowE = 0
      const slowWindow = Math.max(1, Math.floor(blockSize / 8))

      for (let j = 1; j < blockSize; j++) {
        const s = channelData[offset + j]
        const prev = channelData[offset + j - 1]
        totalE += Math.abs(s)
        diffE += Math.abs(s - prev)
      }
      for (let j = 0; j < blockSize - slowWindow; j++) {
        let avg = 0
        for (let k = 0; k < slowWindow; k++) avg += Math.abs(channelData[offset + j + k])
        slowE += avg / slowWindow
      }
      slowE /= Math.max(1, blockSize - slowWindow)

      const avgTotal = totalE / Math.max(1, blockSize)
      const avgDiff = diffE / Math.max(1, blockSize)

      waveform[i] = avgTotal
      waveformLF[i] = slowE
      waveformHF[i] = Math.min(avgTotal, avgDiff * 0.5)
      waveformMF[i] = Math.max(0, avgTotal - slowE * 0.7 - avgDiff * 0.3)
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

  // Estimate BPM from audio buffer (simplified)
  function estimateBPM(buffer: AudioBuffer): number {
    // Simple energy-based BPM estimation
    const channelData = buffer.getChannelData(0)
    const sampleRate = buffer.sampleRate
    const windowSize = Math.floor(sampleRate * 0.2) // 200ms windows
    const energies: number[] = []

    for (let i = 0; i < channelData.length - windowSize; i += windowSize) {
      let energy = 0
      for (let j = 0; j < windowSize; j++) {
        energy += channelData[i + j] * channelData[i + j]
      }
      energies.push(energy / windowSize)
    }

    // Count beats (energy spikes)
    const avgEnergy = energies.reduce((a, b) => a + b, 0) / energies.length
    let beats = 0
    for (const e of energies) {
      if (e > avgEnergy * 1.5) beats++
    }

    const durationSeconds = buffer.duration
    const bpm = Math.round((beats / durationSeconds) * 60)

    // Clamp to reasonable range
    if (bpm < 60) return 120
    if (bpm > 200) return 128
    return bpm
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
        deckNodes.startOffset + elapsed,
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
    setEQ,
    updateCrossfader,
    updateMasterVolume,
    seekDeck,
    startRecording,
    stopRecording,
    getAnalyserData,
    getWaveformData
  }
}
