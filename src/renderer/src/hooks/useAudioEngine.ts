import { useRef, useEffect, useCallback } from 'react'
import { useStore, Track } from '../store/useStore'

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
  playbackRate: number
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
    analyser,
    playbackRate: 1.0
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
        const currentTime = Math.min(eng.deckA.startOffset + elapsed * eng.deckA.playbackRate, eng.deckA.buffer?.duration || 0)
        setDeckA({ currentTime })

        if (eng.deckA.buffer && currentTime >= eng.deckA.buffer.duration) {
          eng.deckA.isPlaying = false
          setDeckA({ isPlaying: false, currentTime: eng.deckA.buffer.duration })
        }
      }

      if (eng.deckB && eng.deckB.isPlaying && eng.context) {
        const elapsed = eng.context.currentTime - eng.deckB.startTime
        const currentTime = Math.min(eng.deckB.startOffset + elapsed * eng.deckB.playbackRate, eng.deckB.buffer?.duration || 0)
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

        const bpm = estimateBPM(audioBuffer)
        const { waveform, waveformLF, waveformMF, waveformHF } = computeWaveformData(audioBuffer)

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
      source.playbackRate.value = deckNodes.playbackRate

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

  // Pitch: value 0–1 where 0.5 = normal speed, 0 = -10%, 1 = +10%
  const setPitch = useCallback((deck: 'A' | 'B', value: number) => {
    const eng = engineRef.current
    const deckNodes = deck === 'A' ? eng.deckA : eng.deckB
    if (!deckNodes) return
    const rate = 1.0 + (value - 0.5) * 0.2
    deckNodes.playbackRate = rate
    if (deckNodes.source) deckNodes.source.playbackRate.value = rate
    const setter = deck === 'A' ? setDeckA : setDeckB
    setter({ pitch: value })
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
    setPitch,
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
