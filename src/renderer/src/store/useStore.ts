import { create } from 'zustand'

export interface Track {
  id: string
  name: string
  filePath: string
  fileUrl: string
  duration?: number
}

export interface DeckState {
  track: Track | null
  isPlaying: boolean
  isCued: boolean
  volume: number
  pitch: number
  bpm: number
  eqLow: number
  eqMid: number
  eqHigh: number
  currentTime: number
  duration: number
  isLoaded: boolean
  waveform: Float32Array | null
  waveformHF: Float32Array | null
}

export interface BroadcastState {
  isConnected: boolean
  isConnecting: boolean
  host: string
  port: number
  mount: string
  password: string
  bitrate: number
  streamName: string
  genre: string
}

export interface RecorderState {
  isRecording: boolean
  recordingTime: number
  hasRecording: boolean
  recordingBlob: Blob | null
}

export interface AppStore {
  // Decks
  deckA: DeckState
  deckB: DeckState
  crossfader: number
  masterVolume: number

  // Library
  tracks: Track[]
  selectedTrackId: string | null

  // Broadcast
  broadcast: BroadcastState

  // Recorder
  recorder: RecorderState

  // Active tab
  activeTab: 'library' | 'broadcast' | 'recorder'

  // Actions
  setDeckA: (updates: Partial<DeckState>) => void
  setDeckB: (updates: Partial<DeckState>) => void
  setCrossfader: (value: number) => void
  setMasterVolume: (value: number) => void
  addTracks: (tracks: Track[]) => void
  removeTrack: (id: string) => void
  setSelectedTrack: (id: string | null) => void
  setBroadcast: (updates: Partial<BroadcastState>) => void
  setRecorder: (updates: Partial<RecorderState>) => void
  setActiveTab: (tab: 'library' | 'broadcast' | 'recorder') => void
}

const defaultDeck: DeckState = {
  track: null,
  isPlaying: false,
  isCued: false,
  volume: 0.8,
  pitch: 0,
  bpm: 0,
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0,
  currentTime: 0,
  duration: 0,
  isLoaded: false,
  waveform: null,
  waveformHF: null
}

export const useStore = create<AppStore>((set) => ({
  deckA: { ...defaultDeck },
  deckB: { ...defaultDeck },
  crossfader: 0.5,
  masterVolume: 0.8,

  tracks: [],
  selectedTrackId: null,

  broadcast: {
    isConnected: false,
    isConnecting: false,
    host: 'localhost',
    port: 8000,
    mount: '/stream',
    password: 'hackme',
    bitrate: 128,
    streamName: 'My Radio Station',
    genre: 'Electronic'
  },

  recorder: {
    isRecording: false,
    recordingTime: 0,
    hasRecording: false,
    recordingBlob: null
  },

  activeTab: 'library',

  setDeckA: (updates) => set((state) => ({ deckA: { ...state.deckA, ...updates } })),
  setDeckB: (updates) => set((state) => ({ deckB: { ...state.deckB, ...updates } })),
  setCrossfader: (value) => set({ crossfader: value }),
  setMasterVolume: (value) => set({ masterVolume: value }),

  addTracks: (tracks) =>
    set((state) => ({
      tracks: [
        ...state.tracks,
        ...tracks.filter((t) => !state.tracks.find((existing) => existing.id === t.id))
      ]
    })),

  removeTrack: (id) =>
    set((state) => ({ tracks: state.tracks.filter((t) => t.id !== id) })),

  setSelectedTrack: (id) => set({ selectedTrackId: id }),

  setBroadcast: (updates) =>
    set((state) => ({ broadcast: { ...state.broadcast, ...updates } })),

  setRecorder: (updates) =>
    set((state) => ({ recorder: { ...state.recorder, ...updates } })),

  setActiveTab: (tab) => set({ activeTab: tab })
}))
