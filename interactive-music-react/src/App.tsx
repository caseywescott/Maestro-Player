import { getSampleEventsFromSoundFont, SynthEvent } from "@ryohey/wavelet"
import { createCueFromMidi } from "maestro/dist/useImuse"
import { MidiFile, read } from "midifile-ts"
import type { ErrorInfo } from "react"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AudioErrorBoundary,
  ErrorBoundary,
  LayerManagement,
  SmartTransitions,
} from "./components"
import { MIDIPlayer } from "./MIDIPlayer"
import type { ExtendedCue } from "./useEnhancediMuse"
import { useEnhancediMuse } from "./useEnhancediMuse"

// ✅ NEW: General MIDI Instrument Names (GM Standard)
const GM_INSTRUMENTS = [
  "Acoustic Grand Piano",
  "Bright Acoustic Piano",
  "Electric Grand Piano",
  "Honky-tonk Piano",
  "Electric Piano 1",
  "Electric Piano 2",
  "Harpsichord",
  "Clavi",
  "Celesta",
  "Glockenspiel",
  "Music Box",
  "Vibraphone",
  "Marimba",
  "Xylophone",
  "Tubular Bells",
  "Dulcimer",
  "Drawbar Organ",
  "Percussive Organ",
  "Rock Organ",
  "Church Organ",
  "Reed Organ",
  "Accordion",
  "Harmonica",
  "Tango Accordion",
  "Acoustic Guitar (nylon)",
  "Acoustic Guitar (steel)",
  "Electric Guitar (jazz)",
  "Electric Guitar (clean)",
  "Electric Guitar (muted)",
  "Overdriven Guitar",
  "Distortion Guitar",
  "Guitar harmonics",
  "Acoustic Bass",
  "Electric Bass (finger)",
  "Electric Bass (pick)",
  "Fretless Bass",
  "Slap Bass 1",
  "Slap Bass 2",
  "Synth Bass 1",
  "Synth Bass 2",
  "Violin",
  "Viola",
  "Cello",
  "Contrabass",
  "Tremolo Strings",
  "Pizzicato Strings",
  "Orchestral Harp",
  "Timpani",
  "String Ensemble 1",
  "String Ensemble 2",
  "SynthStrings 1",
  "SynthStrings 2",
  "Choir Aahs",
  "Voice Oohs",
  "Synth Voice",
  "Orchestra Hit",
  "Trumpet",
  "Trombone",
  "Tuba",
  "Muted Trumpet",
  "French Horn",
  "Brass Section",
  "SynthBrass 1",
  "SynthBrass 2",
  "Soprano Sax",
  "Alto Sax",
  "Tenor Sax",
  "Baritone Sax",
  "Oboe",
  "English Horn",
  "Bassoon",
  "Clarinet",
  "Piccolo",
  "Flute",
  "Recorder",
  "Pan Flute",
  "Blown Bottle",
  "Shakuhachi",
  "Whistle",
  "Ocarina",
  "Lead 1 (square)",
  "Lead 2 (sawtooth)",
  "Lead 3 (calliope)",
  "Lead 4 (chiff)",
  "Lead 5 (charang)",
  "Lead 6 (voice)",
  "Lead 7 (fifths)",
  "Lead 8 (bass + lead)",
  "Pad 1 (new age)",
  "Pad 2 (warm)",
  "Pad 3 (polysynth)",
  "Pad 4 (choir)",
  "Pad 5 (bowed)",
  "Pad 6 (metallic)",
  "Pad 7 (halo)",
  "Pad 8 (sweep)",
  "FX 1 (rain)",
  "FX 2 (soundtrack)",
  "FX 3 (crystal)",
  "FX 4 (atmosphere)",
  "FX 5 (brightness)",
  "FX 6 (goblins)",
  "FX 7 (echoes)",
  "FX 8 (sci-fi)",
  "Sitar",
  "Banjo",
  "Shamisen",
  "Koto",
  "Kalimba",
  "Bag pipe",
  "Fiddle",
  "Shanai",
  "Tinkle Bell",
  "Agogo",
  "Steel Drums",
  "Woodblock",
  "Taiko Drum",
  "Melodic Tom",
  "Synth Drum",
  "Reverse Cymbal",
  "Guitar Fret Noise",
  "Breath Noise",
  "Seashore",
  "Bird Tweet",
  "Telephone Ring",
  "Helicopter",
  "Applause",
  "Gunshot",
]

const soundFontUrl = "soundfonts/chiptune_soundfont_4.0.sf2"

// ✅ OPTIMIZATION: Memoized Status Component
const StatusSection = React.memo(
  ({
    soundFontLoaded,
    loadingStatus,
    cuesLoaded,
  }: {
    soundFontLoaded: boolean
    loadingStatus: string
    cuesLoaded: number
  }) => (
    <div className="status-section">
      <h3>System Status</h3>
      <div className="status-item">
        <strong>Audio:</strong> {soundFontLoaded ? "✅ Ready" : "⏳ Loading..."}
      </div>
      <div className="status-item">
        <strong>Status:</strong> {loadingStatus}
      </div>
      <div className="status-item">
        <strong>Cues Loaded:</strong> {cuesLoaded}
      </div>
    </div>
  )
)

// ✅ OPTIMIZATION: Memoized iMuse Status Component
const IMuseStatus = React.memo(
  ({
    currentCue,
    pendingCue,
    pendingRandomCue,
    transitionStatus,
  }: {
    currentCue: ExtendedCue | null
    pendingCue: ExtendedCue | null
    pendingRandomCue: ExtendedCue | null
    transitionStatus: string | null
  }) => (
    <div className="imuse-status">
      <h3>🎵 iMuse Status</h3>
      {currentCue && (
        <div className="current-cue">
          <strong>Playing:</strong> {currentCue.id}
          {currentCue.metadata?.entryIndex !== undefined && (
            <small> (Entry {currentCue.metadata.entryIndex + 1})</small>
          )}
        </div>
      )}
      {pendingCue && (
        <div className="pending-cue">
          <strong>Next:</strong> {pendingCue.id}
        </div>
      )}
      {pendingRandomCue && (
        <div className="pending-random">
          <strong>Pending Random:</strong> {pendingRandomCue.id}
          {pendingRandomCue.metadata?.entryIndex !== undefined && (
            <small> (Entry {pendingRandomCue.metadata.entryIndex + 1})</small>
          )}
        </div>
      )}
      {transitionStatus && (
        <div className="transition-status">{transitionStatus}</div>
      )}
    </div>
  )
)

// ✅ OPTIMIZATION: Memoized Playback Controls Component
const PlaybackControls = React.memo(
  ({
    isPlaying,
    currentProgress,
    onPlay,
    onPause,
    onStop,
    onSeek,
  }: {
    isPlaying: boolean
    currentProgress: number
    onPlay: () => void
    onPause: () => void
    onStop: () => void
    onSeek: (value: number) => void
  }) => {
    const handleProgressChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onSeek(parseFloat(e.target.value))
      },
      [onSeek]
    )

    return (
      <div className="playback-controls">
        <h4>Playback</h4>
        <div className="button-group">
          <button onClick={onPlay} disabled={isPlaying}>
            {isPlaying ? "▶️ Playing" : "▶️ Play"}
          </button>
          <button onClick={onPause} disabled={!isPlaying}>
            ⏸️ Pause
          </button>
          <button onClick={onStop}>⏹️ Stop</button>
        </div>

        <div className="progress-container">
          <label>Progress:</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.0001"
            value={currentProgress}
            onChange={handleProgressChange}
          />
          <span>{(currentProgress * 100).toFixed(1)}%</span>
        </div>
      </div>
    )
  }
)

// ✅ OPTIMIZATION: Memoized Tempo Controls Component
const TempoControls = React.memo(
  ({
    userTempoOverride,
    originalFileTempo,
    onTempoChange,
    onTempoReset,
  }: {
    userTempoOverride: number | null
    originalFileTempo: number
    onTempoChange: (value: number) => void
    onTempoReset: () => void
  }) => {
    const tempoValue = useMemo(() => {
      return userTempoOverride ? userTempoOverride / originalFileTempo : 1.0
    }, [userTempoOverride, originalFileTempo])

    const tempoDisplay = useMemo(() => {
      return userTempoOverride
        ? `${(userTempoOverride / originalFileTempo).toFixed(2)}x`
        : "1.00x"
    }, [userTempoOverride, originalFileTempo])

    const handleTempoChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onTempoChange(parseFloat(e.target.value))
      },
      [onTempoChange]
    )

    return (
      <div className="tempo-controls">
        <h4>🎼 Tempo Control</h4>
        <div className="control-row">
          <label>Tempo:</label>
          <input
            type="range"
            min="0.25"
            max="4.0"
            step="0.01"
            value={tempoValue}
            onChange={handleTempoChange}
          />
          <span className="value-display">{tempoDisplay}</span>
          <button onClick={onTempoReset}>Reset</button>
        </div>
        <div className="tempo-info">
          <small>
            Original: {originalFileTempo.toFixed(1)} BPM
            {userTempoOverride && (
              <> | Override: {userTempoOverride.toFixed(1)} BPM</>
            )}
          </small>
        </div>
      </div>
    )
  }
)

// ✅ OPTIMIZATION: Memoized Transpose Controls Component
const TransposeControls = React.memo(
  ({
    currentTranspose,
    onTransposeChange,
    onTransposeReset,
  }: {
    currentTranspose: number
    onTransposeChange: (value: number) => void
    onTransposeReset: () => void
  }) => {
    const transposeDisplay = useMemo(() => {
      return currentTranspose > 0
        ? `+${currentTranspose}`
        : `${currentTranspose}`
    }, [currentTranspose])

    const handleTransposeChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onTransposeChange(parseInt(e.target.value))
      },
      [onTransposeChange]
    )

    return (
      <div className="transpose-controls">
        <h4>🎵 Transpose Control</h4>
        <div className="control-row">
          <label>Transpose:</label>
          <input
            type="range"
            min="-24"
            max="24"
            step="1"
            value={currentTranspose}
            onChange={handleTransposeChange}
          />
          <span className="value-display">{transposeDisplay}</span>
          <button onClick={onTransposeReset}>Reset</button>
        </div>
        <div className="transpose-info">
          <small>
            Semitones: {currentTranspose} (
            {currentTranspose !== 0 ? "Active" : "None"})
          </small>
        </div>
      </div>
    )
  }
)

// ✅ OPTIMIZATION: Memoized Reverb Controls Component
const ReverbControls = React.memo(
  ({
    currentReverb,
    onReverbChange,
    onReverbReset,
  }: {
    currentReverb: number
    onReverbChange: (value: number) => void
    onReverbReset: () => void
  }) => {
    const reverbDisplay = useMemo(() => {
      return `${(currentReverb * 100).toFixed(0)}%`
    }, [currentReverb])

    const reverbInfo = useMemo(() => {
      return `${(currentReverb * 100).toFixed(1)}% (${
        currentReverb > 0 ? "Active" : "Off"
      })`
    }, [currentReverb])

    const handleReverbChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onReverbChange(parseFloat(e.target.value))
      },
      [onReverbChange]
    )

    return (
      <div className="reverb-controls">
        <h4>🎚️ Reverb Control</h4>
        <div className="control-row">
          <label>Reverb:</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={currentReverb}
            onChange={handleReverbChange}
          />
          <span className="value-display">{reverbDisplay}</span>
          <button onClick={onReverbReset}>Reset</button>
        </div>
        <div className="reverb-info">
          <small>Amount: {reverbInfo}</small>
        </div>
      </div>
    )
  }
)

// ✅ NEW: MIDI Analysis Type Definition
interface MidiAnalysis {
  channels: Set<number>
  instruments: Map<number, Set<number>>
  noteCount: number
  duration: number
  format?: number
  tracks?: number
  ticksPerBeat?: number
  tempo?: number
  totalNotes: number
  totalControlChanges: number
  totalProgramChanges: number
  trackDetails?: any[]
}

// Helper functions (from original code)
const getMidiDuration = (midi: MidiFile): number => {
  let maxTicks = 0
  midi.tracks.forEach((track) => {
    let currentTicks = 0
    track.forEach((event) => {
      currentTicks += event.deltaTime
      maxTicks = Math.max(maxTicks, currentTicks)
    })
  })
  return maxTicks
}

const extractTempoFromMidi = (midi: MidiFile): number => {
  let tempo = 120 // Default BPM
  if (midi.tracks.length > 0) {
    for (const event of midi.tracks[0]) {
      if (event.type === "meta" && event.subtype === "setTempo") {
        tempo = 60000000 / event.microsecondsPerBeat
        break
      }
    }
  }
  return tempo
}

// ✅ Load cues from JSON file (from original)
const loadCuesFromJson = async (cuePath: string): Promise<any[]> => {
  try {
    const response = await fetch(cuePath)
    if (!response.ok) {
      throw new Error(`Failed to load cues: ${response.status}`)
    }
    const cues = await response.json()
    console.log(`📋 Loaded ${cues.length} cue(s) from ${cuePath}:`, cues)
    return cues
  } catch (error) {
    console.error(`❌ Error loading cues from ${cuePath}:`, error)
    return []
  }
}

// ✅ Create cue from MIDI with entry point (from original)
const createCueFromMidiWithEntryPoint = (
  id: string,
  midi: MidiFile,
  entryPointTicks: number
): ExtendedCue => {
  const totalDuration = getMidiDuration(midi)
  const entryPointRatio = entryPointTicks / totalDuration

  console.log(
    `🎵 Creating cue "${id}" with entry point at ${entryPointTicks} ticks (${(
      entryPointRatio * 100
    ).toFixed(1)}% through track)`
  )

  // Create the base cue using maestro
  const baseCue = createCueFromMidi(id, midi)

  // Modify the cue to have custom entry points
  const customCue: ExtendedCue = {
    ...baseCue,
    entryPoints: [0, entryPointTicks], // Add both beginning and halfway points
    startOffset: entryPointTicks, // Custom property to track where playback should start
    metadata: {
      totalDuration,
      entryPointRatio,
      originalEntryPoints: baseCue.entryPoints,
    },
  }

  return customCue
}

// ✅ Create cue from JSON data with specific entry point (from original)
const createCueFromJsonData = (
  midi: MidiFile,
  cueData: any,
  entryPointIndex: number = 0
): ExtendedCue => {
  const entryPoints = cueData.entryPoints || [[0, 0.0]]
  const selectedEntry = entryPoints[entryPointIndex] || entryPoints[0]
  const [entryTicks, entrySeconds] = selectedEntry

  console.log(
    `🎯 Creating cue from JSON data - Entry ${entryPointIndex + 1}/${
      entryPoints.length
    }: ${entryTicks} ticks (${entrySeconds.toFixed(3)}s)`
  )

  // Create the base cue using maestro
  const baseCue = createCueFromMidi(cueData.id, midi)

  // Modify the cue to use the JSON entry points
  const customCue: ExtendedCue = {
    ...baseCue,
    entryPoints: entryPoints.map(([ticks, _]: [number, number]) => ticks), // Extract just the tick values
    startOffset: entryTicks,
    metadata: {
      totalDuration: getMidiDuration(midi),
      entryPointRatio: entryTicks / getMidiDuration(midi),
      originalEntryPoints: baseCue.entryPoints,
      entryIndex: entryPointIndex,
      entryPoints: entryPoints,
    },
    // Override with JSON data if available
    tempo: cueData.tempo || baseCue.tempo,
    key: cueData.key !== undefined ? cueData.key : baseCue.key,
  }

  return customCue
}

// ✅ Create random cue from JSON data (from original)
const createRandomCueFromJson = (midi: MidiFile, cueData: any): ExtendedCue => {
  const entryPoints = cueData.entryPoints || [[0, 0.0]]
  const randomIndex = Math.floor(Math.random() * entryPoints.length)
  const [entryTicks, entrySeconds] = entryPoints[randomIndex]

  console.log(
    `🎲 Random cue selection: Entry ${randomIndex + 1}/${
      entryPoints.length
    } at ${entrySeconds.toFixed(3)}s (${entryTicks} ticks)`
  )

  const cue = createCueFromJsonData(midi, cueData, randomIndex)
  return cue
}

// ✅ Create halfway cue (from original)
const createHalfwayCue = (id: string, midi: MidiFile): ExtendedCue => {
  const totalDuration = getMidiDuration(midi)
  const halfwayPoint = Math.floor(totalDuration / 2)
  return createCueFromMidiWithEntryPoint(id + "_halfway", midi, halfwayPoint)
}

const App: React.FC = () => {
  // ✅ AUDIO: Audio Context Management (FIXED: Added null initialization)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const synthRef = useRef<AudioWorkletNode | null>(null)

  // State
  const [soundFontLoaded, setSoundFontLoaded] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState("Initializing...")
  const [loadedCuesData, setLoadedCuesData] = useState<any[]>([])
  const [currentMidi, setCurrentMidi] = useState<MidiFile | null>(null)
  const [pendingRandomCue, setPendingRandomCue] = useState<ExtendedCue | null>(
    null
  )
  const [availableCues, setAvailableCues] = useState<ExtendedCue[]>([])
  const [currentCueEntryIndex, setCurrentCueEntryIndex] = useState(0)

  // ✅ NEW: Analysis and Instrument State
  const [midiAnalysis, setMidiAnalysis] = useState<MidiAnalysis | null>(null)
  const [soundFontAnalysis, setSoundFontAnalysis] = useState<any>(null)
  const [currentInstruments, setCurrentInstruments] = useState<{
    [channel: number]: number
  }>({})
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [selectedAnalysisTab, setSelectedAnalysisTab] = useState<
    "midi" | "soundfont" | "instruments" | "transitions" | "layers"
  >("midi")

  // Enhanced iMuse Hook
  const iMuse = useEnhancediMuse({
    preserveTempoOverride: true,
    adaptiveLayers: true,
  })

  // ✅ OPTIMIZATION: Memoized callbacks for buttons and handlers
  const handleLoadExample = useCallback(async () => {
    if (!contextRef.current) return

    contextRef.current.resume()
    setLoadingStatus("Loading example MIDI...")

    try {
      // Load both the MIDI file and its cues (like original)
      const [midiData, cuesData] = await Promise.all([
        fetch("/midi/Realms_Piano_NomadBallad_SySx.mid").then((res) =>
          res.arrayBuffer()
        ),
        loadCuesFromJson("/midi/cues.json"),
      ])

      const midi = read(midiData)
      setCurrentMidi(midi)

      // ✅ Create available cues for smart transitions
      const createdCues: ExtendedCue[] = []
      if (cuesData && cuesData.length > 0) {
        cuesData.forEach((cueData, index) => {
          try {
            const cue = createCueFromJsonData(midi, cueData, index)
            createdCues.push(cue)
          } catch (error) {
            console.warn(`Failed to create cue ${index}:`, error)
          }
        })
      } else {
        // Create some default cues if no cue data is available
        const defaultCue = createCueFromMidiWithEntryPoint("default", midi, 0)
        const halfwayCue = createHalfwayCue("halfway", midi)
        createdCues.push(defaultCue, halfwayCue)
      }
      setAvailableCues(createdCues)
      console.log(
        `🎵 Created ${createdCues.length} available cues for smart transitions`
      )

      // ✅ NEW: Analyze fallback MIDI too
      try {
        const midiAnalysisResult = analyzeMidiFile(midi)
        setMidiAnalysis(midiAnalysisResult)
      } catch (error) {
        console.warn(
          "⚠️ Fallback MIDI analysis failed, continuing without analysis:",
          error
        )
      }

      const originalTempo = extractTempoFromMidi(midi)
      console.log(
        `📁 Loaded MIDI file with original tempo: ${originalTempo.toFixed(
          1
        )} BPM`
      )

      // Store the midi in the hook
      iMuse.setCurrentMidi(midi)

      let currentCue: ExtendedCue

      if (cuesData.length > 0) {
        // Use the first cue data (should match the MIDI file)
        const cueData =
          cuesData.find((cue) => cue.id === "Realms_Piano_NomadBallad_SySx") ||
          cuesData[0]
        currentCue = createRandomCueFromJson(midi, cueData)

        // Enhance the cue with current state
        currentCue = iMuse.enhanceCueForCurrentState(currentCue)

        setLoadedCuesData(cuesData) // Store for random cue button

        // Set the current entry index from the cue metadata
        if (currentCue.metadata?.entryIndex !== undefined) {
          setCurrentCueEntryIndex(currentCue.metadata.entryIndex)
        }

        console.log(
          "🎹 iMuse: Primary cue created with random entry point and adaptive enhancements:",
          currentCue
        )
      } else {
        // Fallback to halfway point if cues.json failed to load
        currentCue = createHalfwayCue("realms_piano_ballad_sysx", midi)

        // Enhance the fallback cue with current state
        currentCue = iMuse.enhanceCueForCurrentState(currentCue)

        console.log(
          "🎹 iMuse: Primary cue created with halfway entry point and enhancements (fallback):",
          currentCue
        )
      }

      // Create MIDIPlayer
      const postSynthMessage = (e: SynthEvent, transfer?: Transferable[]) => {
        if (synthRef.current) {
          synthRef.current.port.postMessage(e, transfer ?? [])
        }
      }

      const midiPlayer = new MIDIPlayer(
        midi,
        contextRef.current.sampleRate,
        postSynthMessage
      )

      // Set the player in the hook
      iMuse.setMidiPlayer(midiPlayer)

      // Apply entry point if specified
      if (currentCue.startOffset && currentCue.startOffset > 0) {
        const totalDuration = getMidiDuration(midi)
        const startRatio = currentCue.startOffset / totalDuration
        console.log(
          `🚀 Starting playback from ${(startRatio * 100).toFixed(1)}% (${
            currentCue.startOffset
          } ticks)`
        )
        midiPlayer.seek(startRatio)
      }

      // Play using iMuse
      iMuse.playInitialCue(currentCue)
      midiPlayer.resume()

      setLoadingStatus("Playing!")
    } catch (error) {
      console.error("❌ Error loading MIDI or cues:", error)
      // Ultimate fallback - load the original file
      try {
        const midiData = await (
          await fetch("/midi/Realms_Piano_NomadBallad.mid")
        ).arrayBuffer()
        const midi = read(midiData)
        setCurrentMidi(midi)

        // ✅ NEW: Analyze fallback MIDI too
        const midiAnalysisResult = analyzeMidiFile(midi)
        setMidiAnalysis(midiAnalysisResult)

        const currentCue = createHalfwayCue("realms_piano_ballad", midi)

        const postSynthMessage = (e: SynthEvent, transfer?: Transferable[]) => {
          if (synthRef.current) {
            synthRef.current.port.postMessage(e, transfer ?? [])
          }
        }

        const midiPlayer = new MIDIPlayer(
          midi,
          contextRef.current!.sampleRate,
          postSynthMessage
        )

        iMuse.setMidiPlayer(midiPlayer)
        iMuse.setCurrentMidi(midi)
        iMuse.playInitialCue(currentCue)
        midiPlayer.resume()

        console.log("🎹 Loaded fallback MIDI file")
        setLoadingStatus("Playing fallback!")
      } catch (fallbackError) {
        console.error("❌ Fallback also failed:", fallbackError)
        setLoadingStatus(`Error: ${fallbackError}`)
      }
    }
  }, [iMuse])

  // ✅ NEW: Handler for user-uploaded MIDI files
  const handleLoadUserMidi = useCallback(
    async (file: File) => {
      if (!contextRef.current) return

      contextRef.current.resume()
      setLoadingStatus("Loading user MIDI file...")

      try {
        // Read the user's MIDI file
        const arrayBuffer = await file.arrayBuffer()
        const midi = read(arrayBuffer)
        setCurrentMidi(midi)

        // Load the same cues.json file for transitions
        const cuesData = await loadCuesFromJson("/midi/cues.json")

        // ✅ Create available cues for smart transitions
        const createdCues: ExtendedCue[] = []
        if (cuesData && cuesData.length > 0) {
          cuesData.forEach((cueData, index) => {
            try {
              const cue = createCueFromJsonData(midi, cueData, index)
              createdCues.push(cue)
            } catch (error) {
              console.warn(`Failed to create cue ${index}:`, error)
            }
          })
        } else {
          // Create some default cues if no cue data is available
          const defaultCue = createCueFromMidiWithEntryPoint("default", midi, 0)
          const halfwayCue = createHalfwayCue("halfway", midi)
          createdCues.push(defaultCue, halfwayCue)
        }
        setAvailableCues(createdCues)
        console.log(
          `🎵 Created ${createdCues.length} available cues for smart transitions from user MIDI`
        )

        // ✅ Analyze the user's MIDI file
        try {
          const midiAnalysisResult = analyzeMidiFile(midi)
          setMidiAnalysis(midiAnalysisResult)
        } catch (error) {
          console.warn(
            "⚠️ User MIDI analysis failed, continuing without analysis:",
            error
          )
        }

        const originalTempo = extractTempoFromMidi(midi)
        console.log(
          `📁 Loaded user MIDI file "${
            file.name
          }" with original tempo: ${originalTempo.toFixed(1)} BPM`
        )

        // Store the midi in the hook
        iMuse.setCurrentMidi(midi)

        let currentCue: ExtendedCue

        if (cuesData.length > 0) {
          // Use the first cue data for the user's MIDI file
          const cueData = cuesData[0]
          currentCue = createRandomCueFromJson(midi, cueData)

          // Enhance the cue with current state
          currentCue = iMuse.enhanceCueForCurrentState(currentCue)

          setLoadedCuesData(cuesData) // Store for random cue button

          // Set the current entry index from the cue metadata
          if (currentCue.metadata?.entryIndex !== undefined) {
            setCurrentCueEntryIndex(currentCue.metadata.entryIndex)
          }

          console.log(
            "🎹 iMuse: User MIDI cue created with random entry point and adaptive enhancements:",
            currentCue
          )
        } else {
          // Fallback to halfway point if cues.json failed to load
          currentCue = createHalfwayCue("user_midi", midi)

          // Enhance the fallback cue with current state
          currentCue = iMuse.enhanceCueForCurrentState(currentCue)

          console.log(
            "🎹 iMuse: User MIDI cue created with halfway entry point and enhancements (fallback):",
            currentCue
          )
        }

        // Create MIDIPlayer
        const postSynthMessage = (e: SynthEvent, transfer?: Transferable[]) => {
          if (synthRef.current) {
            synthRef.current.port.postMessage(e, transfer ?? [])
          }
        }

        const midiPlayer = new MIDIPlayer(
          midi,
          contextRef.current.sampleRate,
          postSynthMessage
        )

        // Set the player in the hook
        iMuse.setMidiPlayer(midiPlayer)

        // Apply entry point if specified
        if (currentCue.startOffset && currentCue.startOffset > 0) {
          const totalDuration = getMidiDuration(midi)
          const startRatio = currentCue.startOffset / totalDuration
          console.log(
            `🚀 Starting user MIDI playback from ${(startRatio * 100).toFixed(
              1
            )}% (${currentCue.startOffset} ticks)`
          )
          midiPlayer.seek(startRatio)
        }

        // Play using iMuse
        iMuse.playInitialCue(currentCue)
        midiPlayer.resume()

        setLoadingStatus(`Playing user MIDI: ${file.name}`)
      } catch (error) {
        console.error("❌ Error loading user MIDI file:", error)
        setLoadingStatus(`Error loading ${file.name}: ${error}`)
      }
    },
    [iMuse]
  )

  // ✅ OPTIMIZATION: Memoized random cue handler
  const handleRandomCue = useCallback(async () => {
    console.log("🎲 Random cue button clicked - checking state:", {
      currentMidi: !!currentMidi,
      loadedCuesData: loadedCuesData.length,
      currentCue: !!iMuse.currentCue,
      pendingRandomCue: !!pendingRandomCue,
    })

    if (!iMuse.currentCue) {
      console.log("❌ No current cue is playing")
      return
    }

    if (pendingRandomCue) {
      console.log("⚠️ Random cue transition already pending, please wait...")
      return
    }

    contextRef.current?.resume() // Resume audio context

    try {
      let newRandomCue: ExtendedCue

      if (currentMidi && loadedCuesData.length > 0) {
        console.log("🎯 Using JSON cue data for random selection")
        // Find the matching cue data
        const cueData =
          loadedCuesData.find(
            (cue) => cue.id === "Realms_Piano_NomadBallad_SySx"
          ) || loadedCuesData[0]

        // Create a new random cue
        newRandomCue = createRandomCueFromJson(currentMidi, cueData)
      } else {
        console.log("🎯 Creating simple random cue (fallback)")
        // Fallback: create a simple random cue with different starting point
        const currentCueBase = iMuse.currentCue
        const randomOffset = Math.floor(Math.random() * 5000) // Random offset up to 5000 ticks

        newRandomCue = {
          ...currentCueBase,
          id: `${currentCueBase.id}_random_${Date.now()}`,
          startOffset: randomOffset,
          metadata: {
            totalDuration: currentMidi ? getMidiDuration(currentMidi) : 10000,
            entryPointRatio:
              randomOffset /
              (currentMidi ? getMidiDuration(currentMidi) : 10000),
            originalEntryPoints: currentCueBase.entryPoints || [0],
            entryIndex: 0,
            entryPoints: [[randomOffset, randomOffset / 480]], // Simple entry point
          },
        }
      }

      // Enhance the cue with current state
      const enhancedCue = iMuse.enhanceCueForCurrentState(newRandomCue)
      setPendingRandomCue(enhancedCue)

      console.log(
        "🎲 iMuse: New random cue point prepared with adaptive enhancements:",
        enhancedCue
      )

      // Show immediate status
      iMuse.setTransitionStatus(
        "🎵 iMuse: Random cue pending - will transition soon..."
      )

      // For fallback mode, transition more quickly
      if (!currentMidi || loadedCuesData.length === 0) {
        console.log("⚡ Using quick transition mode (no JSON cues)")
        setTimeout(() => {
          if (pendingRandomCue) {
            console.log("⏰ Executing quick transition now")
            const cue = enhancedCue
            setPendingRandomCue(null)
            iMuse.clearTransitionStatus()
            iMuse.transitionToCue(cue, {
              waitForBar: false, // Don't wait for bars in fallback mode
              matchKey: true,
              matchTempo: false,
              fadeInDuration: 300,
              fadeOutDuration: 300,
            })
          }
        }, 2000) // 2 second delay
      } else {
        // Original sophisticated logic with boundary detection
        const endTicks = getCurrentCueEndTicks()
        if (endTicks !== null) {
          const totalDuration = getMidiDuration(currentMidi)
          const endRatio = endTicks / totalDuration
          const remainingTime =
            (endRatio - iMuse.currentProgress) * totalDuration

          console.log(
            `⏳ Waiting for current cue to finish... (${Math.max(
              0,
              remainingTime
            ).toFixed(0)} ticks remaining)`
          )
          console.log("🎵 New random cue will start when current segment ends")

          // Show initial status
          const remainingPercent = (
            (endRatio - iMuse.currentProgress) *
            100
          ).toFixed(1)
          iMuse.setTransitionStatus(
            `🎵 iMuse: Transition pending - ${remainingPercent}% remaining in current cue`
          )
        } else {
          console.log("⏳ Waiting for current cue to finish...")
          iMuse.setTransitionStatus(
            "🎵 iMuse: Transition pending - waiting for current cue to finish"
          )
        }
      }
    } catch (error) {
      console.error("❌ Error creating new random cue:", error)
      setPendingRandomCue(null)
    }
  }, [currentMidi, loadedCuesData, iMuse, pendingRandomCue])

  // ✅ OPTIMIZATION: Memoized smart transition handler
  const handleSmartTransition = useCallback(() => {
    if (!iMuse.currentCue) {
      console.log("No current cue for transition")
      return
    }

    if (!currentMidi || loadedCuesData.length === 0) {
      console.log("Creating simple variant cue for demonstration")
      // Create a new cue with different entry point for demonstration
      const newCue = {
        ...iMuse.currentCue,
        id: `${iMuse.currentCue.id}_variant`,
        entryPoints: [Math.floor(Math.random() * 1000)], // Random entry point
      }
      iMuse.smartTransition(newCue, "user_input")
      return
    }

    // Use the sophisticated logic with JSON cues
    const cueData =
      loadedCuesData.find(
        (cue) => cue.id === "Realms_Piano_NomadBallad_SySx"
      ) || loadedCuesData[0]

    const newCue = createRandomCueFromJson(currentMidi, cueData)
    const enhancedCue = iMuse.enhanceCueForCurrentState(newCue)

    console.log("🎼 Smart transition to enhanced random cue:", enhancedCue)
    iMuse.smartTransition(enhancedCue, "user_input")
  }, [currentMidi, loadedCuesData, iMuse])

  // ✅ OPTIMIZATION: Memoized debug transition handler
  const handleDebugTransition = useCallback(() => {
    console.log("🧪 Debug: Immediate transition test")
    if (
      iMuse.currentCue &&
      contextRef.current &&
      synthRef.current &&
      currentMidi
    ) {
      const debugCue = {
        ...iMuse.currentCue,
        id: `${iMuse.currentCue.id}_debug_${Date.now()}`,
        startOffset: Math.floor(Math.random() * 2000),
      }
      console.log("🧪 Transitioning to debug cue:", debugCue)

      // Stop current player cleanly
      stopCurrentPlayer()

      // Create new MIDIPlayer for immediate transition
      const postSynthMessage = (e: SynthEvent, transfer?: Transferable[]) => {
        if (synthRef.current) {
          synthRef.current.port.postMessage(e, transfer ?? [])
        }
      }

      const newMidiPlayer = new MIDIPlayer(
        currentMidi,
        contextRef.current.sampleRate,
        postSynthMessage
      )

      iMuse.setMidiPlayer(newMidiPlayer)

      if (debugCue.startOffset && debugCue.startOffset > 0) {
        const totalDuration = getMidiDuration(currentMidi)
        const startRatio = debugCue.startOffset / totalDuration
        console.log(
          `🚀 Debug transition starting from ${(startRatio * 100).toFixed(1)}%`
        )
        newMidiPlayer.seek(startRatio)
      }

      iMuse.playInitialCue(debugCue)
      newMidiPlayer.resume()

      console.log("✅ Debug transition completed!")
    }
  }, [iMuse, currentMidi])

  // ✅ OPTIMIZATION: Memoized reverb change handler
  const handleReverbChange = useCallback(
    (reverbAmount: number) => {
      iMuse.setReverb(reverbAmount)
      // Trigger adaptive layer adjustments
      if (reverbAmount > 0.5) {
        iMuse.adjustLayersBasedOnUserActions("reverb_change")
      }
    },
    [iMuse]
  )

  // ✅ OPTIMIZATION: Memoized instrument change handler
  const changeInstrument = useCallback((channel: number, program: number) => {
    console.log(`🎹 Changing channel ${channel} to instrument ${program}`)

    if (synthRef.current) {
      // Send program change event to synth
      synthRef.current.port.postMessage({
        type: "midi",
        midi: {
          type: "channel",
          subtype: "programChange",
          channel: channel,
          value: program,
        },
        delayTime: 0,
        sequenceNumber: Date.now(),
      })

      // Update local state
      setCurrentInstruments((prev) => ({
        ...prev,
        [channel]: program,
      }))

      console.log(
        `✅ Instrument changed: Channel ${channel} → Program ${program}`
      )
    }
  }, [])

  // ✅ OPTIMIZATION: Memoized preset handlers
  const presetHandlers = useMemo(
    () => ({
      allPiano: () => {
        if (midiAnalysis) {
          const channels = Array.from(midiAnalysis.channels as Set<number>)
          channels.forEach((channel: number) => {
            changeInstrument(channel, 0) // Piano
          })
        }
      },
      allStrings: () => {
        if (midiAnalysis) {
          const channels = Array.from(midiAnalysis.channels as Set<number>)
          channels.forEach((channel: number) => {
            changeInstrument(channel, 40) // Violin
          })
        }
      },
      allWinds: () => {
        if (midiAnalysis) {
          const channels = Array.from(midiAnalysis.channels as Set<number>)
          channels.forEach((channel: number) => {
            changeInstrument(channel, 73) // Flute
          })
        }
      },
      randomizeAll: () => {
        if (midiAnalysis) {
          const channels = Array.from(midiAnalysis.channels as Set<number>)
          channels.forEach((channel: number) => {
            changeInstrument(channel, Math.floor(Math.random() * 128))
          })
        }
      },
    }),
    [midiAnalysis, changeInstrument]
  )

  // ✅ OPTIMIZATION: Memoized toggle analysis handler
  const toggleAnalysis = useCallback(() => {
    setShowAnalysis((prev) => !prev)
  }, [])

  // ✅ OPTIMIZATION: Memoized tab change handler
  const handleTabChange = useCallback(
    (tab: "midi" | "soundfont" | "instruments" | "transitions" | "layers") => {
      setSelectedAnalysisTab(tab)
    },
    []
  )

  // ✅ Helper function for instrument names
  const getInstrumentName = useCallback((program: number) => {
    return GM_INSTRUMENTS[program] || `Program ${program}`
  }, [])

  // ✅ Calculate when current cue should end based on JSON entry points (from original)
  const getCurrentCueEndTicks = (): number | null => {
    if (
      !iMuse.currentCue?.metadata?.entryPoints ||
      iMuse.currentCue.metadata.entryIndex === undefined
    ) {
      return null
    }

    const entryPoints = iMuse.currentCue.metadata.entryPoints
    const currentIndex = iMuse.currentCue.metadata.entryIndex

    // If this is the last entry point, use the total duration
    if (currentIndex >= entryPoints.length - 1) {
      return currentMidi ? getMidiDuration(currentMidi) : null
    }

    // Otherwise, use the next entry point as the end
    const nextEntryPoint = entryPoints[currentIndex + 1]
    return nextEntryPoint[0] // Return ticks
  }

  // ✅ Helper function to safely stop current MIDIPlayer
  const stopCurrentPlayer = () => {
    console.log("🛑 Stopping current MIDIPlayer...")
    iMuse.stop() // Use the hook's stop function
    iMuse.setMidiPlayer(null) // Clear the player reference
    console.log("✅ Current MIDIPlayer stopped and cleared")
  }

  // ✅ NEW: MIDI Analysis Functions (FIXED: Better type checking)
  const analyzeMidiFile = (midi: MidiFile): MidiAnalysis => {
    const analysis: MidiAnalysis = {
      channels: new Set<number>(),
      instruments: new Map<number, Set<number>>(),
      noteCount: 0,
      duration: getMidiDuration(midi),
      format: (midi.header as any).format || 1,
      tracks: midi.tracks.length,
      ticksPerBeat: midi.header.ticksPerBeat,
      tempo: extractTempoFromMidi(midi),
      totalNotes: 0,
      totalControlChanges: 0,
      totalProgramChanges: 0,
      trackDetails: [],
    }

    midi.tracks.forEach((track, trackIndex) => {
      let trackEvents = 0
      let trackNotes = 0

      track.forEach((event: any) => {
        trackEvents++

        // ✅ FIXED: Proper type checking for different MIDI event types
        if (event && typeof event === "object") {
          // Handle channel events (noteOn, noteOff, programChange, controlChange)
          if (event.type === "channel" && typeof event.channel === "number") {
            analysis.channels.add(event.channel)

            // ✅ FIXED: Proper subtype checking for channel events
            if (
              event.subtype === "noteOn" &&
              typeof event.velocity === "number" &&
              event.velocity > 0
            ) {
              trackNotes++
              analysis.noteCount++
              analysis.totalNotes++
            } else if (
              event.subtype === "noteOff" ||
              (event.subtype === "noteOn" && event.velocity === 0)
            ) {
              // Count note off events but don't increment total notes
            } else if (
              event.subtype === "controller" ||
              event.subtype === "controlChange"
            ) {
              // ✅ FIXED: Handle both possible names for control change events
              if (
                typeof event.controllerType === "number" ||
                typeof event.controller === "number"
              ) {
                analysis.totalControlChanges++
              }
            } else if (event.subtype === "programChange") {
              // ✅ FIXED: Handle program change events properly
              if (
                typeof event.value === "number" ||
                typeof event.program === "number"
              ) {
                analysis.totalProgramChanges++
                const program = event.value ?? event.program
                if (typeof program === "number") {
                  if (!analysis.instruments.has(event.channel)) {
                    analysis.instruments.set(event.channel, new Set())
                  }
                  analysis.instruments.get(event.channel)!.add(program)
                }
              }
            }
          }
          // Handle meta events (tempo, time signature, etc.)
          else if (event.type === "meta") {
            // Meta events don't have channels, just process them for metadata
            if (
              event.subtype === "setTempo" &&
              typeof event.microsecondsPerBeat === "number"
            ) {
              // Tempo change detected
            }
          }
          // Handle system events (sysex, etc.)
          else if (event.type === "sysex") {
            // System exclusive events
          }
        }
      })

      analysis.trackDetails!.push({
        index: trackIndex,
        events: trackEvents,
        notes: trackNotes,
      })
    })

    return analysis
  }

  const analyzeSoundFont = (synthEvents: any[]) => {
    console.log("🔍 Analyzing SoundFont...")
    console.log("📊 Total SoundFont events:", synthEvents.length)

    try {
      const instruments = new Map<number, any>()
      const samples = new Map<string, any>()
      let totalSampleSize = 0

      synthEvents.forEach((eventWrapper, index) => {
        try {
          // The event might be directly in the wrapper or nested
          let event = eventWrapper?.event || eventWrapper

          if (!event) return

          // Debug: log first few events to understand structure
          if (index < 3) {
            console.log(`🔍 Event ${index}:`, {
              type: event.type,
              hasData: !!event.data,
              hasName: !!event.name,
              hasSampleID: !!event.sampleID,
              keys: Object.keys(event),
            })
          }

          // ✅ FIXED: Better type checking for event properties
          // Handle different event types with proper type guards
          switch (event.type) {
            case "loadSample":
              // ✅ FIXED: Only access properties if they exist and have correct types
              if (
                event.data &&
                (Array.isArray(event.data) ||
                  event.data.byteLength ||
                  event.data.length)
              ) {
                const sampleName =
                  (typeof event.name === "string" ? event.name : null) ||
                  (typeof event.sampleID === "string"
                    ? event.sampleID
                    : null) ||
                  `Sample_${index}`
                const sampleSize = Array.isArray(event.data)
                  ? event.data.length
                  : typeof event.data.byteLength === "number"
                  ? event.data.byteLength
                  : typeof event.data.length === "number"
                  ? event.data.length
                  : 0

                samples.set(sampleName, {
                  name: sampleName,
                  size: sampleSize,
                  sampleRate:
                    typeof event.sampleRate === "number"
                      ? event.sampleRate
                      : 44100,
                  channels:
                    typeof event.channels === "number" ? event.channels : 1,
                })
                totalSampleSize += sampleSize
              }
              break

            case "loadInstrument":
              // ✅ FIXED: Type guard for program property
              if (typeof event.program === "number") {
                instruments.set(event.program, {
                  program: event.program,
                  name:
                    (typeof event.name === "string" ? event.name : null) ||
                    getInstrumentName(event.program),
                  bank: typeof event.bank === "number" ? event.bank : 0,
                  samples: Array.isArray(event.samples) ? event.samples : [],
                })
              }
              break

            default:
              // ✅ FIXED: Try to extract sample data from any event with data, with type guards
              if (event.data && !samples.has(`Sample_${index}`)) {
                const sampleSize = Array.isArray(event.data)
                  ? event.data.length
                  : typeof event.data.byteLength === "number"
                  ? event.data.byteLength
                  : typeof event.data.length === "number"
                  ? event.data.length
                  : 0
                if (sampleSize > 0) {
                  samples.set(`Sample_${index}`, {
                    name:
                      (typeof event.name === "string" ? event.name : null) ||
                      `Sample_${index}`,
                    size: sampleSize,
                    sampleRate:
                      typeof event.sampleRate === "number"
                        ? event.sampleRate
                        : 44100,
                    channels:
                      typeof event.channels === "number" ? event.channels : 1,
                  })
                  totalSampleSize += sampleSize
                }
              }
              break
          }
        } catch (eventError) {
          console.warn(`⚠️ Error processing event ${index}:`, eventError)
        }
      })

      const result = {
        totalInstruments: instruments.size,
        totalSamples: samples.size,
        instruments: Array.from(instruments.values()).sort(
          (a, b) => a.program - b.program
        ),
        samples: Array.from(samples.values()),
        totalSampleSize: totalSampleSize,
        sampleSizeMB: (totalSampleSize / (1024 * 1024)).toFixed(1),
      }

      console.log("✅ SoundFont Analysis Result:", result)
      return result
    } catch (error) {
      console.error("❌ Error analyzing SoundFont:", error)

      // ✅ FIXED: Better fallback result with type safety
      return {
        totalInstruments: 0,
        totalSamples: synthEvents.length,
        instruments: [],
        samples: synthEvents.map((eventWrapper, index) => {
          const event = eventWrapper?.event || eventWrapper || {}
          return {
            name:
              (typeof event.name === "string" ? event.name : null) ||
              `Sample_${index}`,
            size: 0,
            sampleRate: 44100,
            channels: 1,
          }
        }),
        totalSampleSize: 0,
        sampleSizeMB: "0.0",
      }
    }
  }

  // ✅ Check cue progress for boundary detection (from original)
  const checkCueProgress = useCallback(() => {
    if (!iMuse.currentCue || !pendingRandomCue) {
      return
    }

    console.log("🔍 Checking cue progress:", {
      currentProgress: iMuse.currentProgress,
      currentCue: iMuse.currentCue.id,
      pendingCue: pendingRandomCue.id,
      hasMetadata: !!iMuse.currentCue.metadata,
      entryIndex: iMuse.currentCue.metadata?.entryIndex,
    })

    const endTicks = getCurrentCueEndTicks()

    if (endTicks !== null && currentMidi) {
      const totalDuration = getMidiDuration(currentMidi)
      const endRatio = endTicks / totalDuration
      const remainingRatio = endRatio - iMuse.currentProgress

      console.log("🎵 Progress check:", {
        endTicks,
        totalDuration,
        endRatio,
        currentProgress: iMuse.currentProgress,
        remainingRatio,
      })

      // Update status with remaining time
      if (remainingRatio > 0) {
        const remainingPercent = (remainingRatio * 100).toFixed(1)
        iMuse.setTransitionStatus(
          `🎵 iMuse: Transition pending - ${remainingPercent}% remaining in current cue`
        )
      }

      // Check if we've reached the end of the current cue (with small buffer)
      if (iMuse.currentProgress >= endRatio - 0.001) {
        console.log(
          "✅ iMuse: Current cue reached its end point, transitioning to new random cue"
        )

        // ✅ FIXED: Properly stop old player before creating new one
        const newCue = pendingRandomCue
        setPendingRandomCue(null)
        iMuse.clearTransitionStatus()

        // Stop current player cleanly
        stopCurrentPlayer()

        console.log(
          "🎲 iMuse: Creating new MIDIPlayer for random cue:",
          newCue.id
        )

        // Create a completely new MIDIPlayer for the random cue
        if (contextRef.current && synthRef.current && currentMidi) {
          const postSynthMessage = (
            e: SynthEvent,
            transfer?: Transferable[]
          ) => {
            if (synthRef.current) {
              synthRef.current.port.postMessage(e, transfer ?? [])
            }
          }

          // Create new player
          const newMidiPlayer = new MIDIPlayer(
            currentMidi,
            contextRef.current.sampleRate,
            postSynthMessage
          )

          // Set the new player in the hook
          iMuse.setMidiPlayer(newMidiPlayer)

          // Apply the random cue's entry point
          if (newCue.startOffset && newCue.startOffset > 0) {
            const totalDuration = getMidiDuration(currentMidi)
            const startRatio = newCue.startOffset / totalDuration
            console.log(
              `🚀 Random cue starting from ${(startRatio * 100).toFixed(1)}% (${
                newCue.startOffset
              } ticks)`
            )
            newMidiPlayer.seek(startRatio)
          }

          // Start the new cue using iMuse
          iMuse.playInitialCue(newCue)
          newMidiPlayer.resume()

          // Update current cue and entry index
          if (newCue.metadata?.entryIndex !== undefined) {
            setCurrentCueEntryIndex(newCue.metadata.entryIndex)
          }

          console.log("✅ Random cue transition completed with new MIDIPlayer!")
        }
      }
    } else {
      console.log(
        "⚠️ No end ticks found or no current MIDI, trying simple time-based transition"
      )
      // Fallback: transition after 30% of the track
      if (iMuse.currentProgress > 0.3) {
        console.log("⏰ Triggering time-based transition at 30% progress")

        const newCue = pendingRandomCue
        setPendingRandomCue(null)
        iMuse.clearTransitionStatus()

        // Stop current player cleanly (fallback mode)
        stopCurrentPlayer()

        console.log(
          "🎲 iMuse: Creating new MIDIPlayer for fallback random cue:",
          newCue.id
        )

        if (contextRef.current && synthRef.current && currentMidi) {
          const postSynthMessage = (
            e: SynthEvent,
            transfer?: Transferable[]
          ) => {
            if (synthRef.current) {
              synthRef.current.port.postMessage(e, transfer ?? [])
            }
          }

          const newMidiPlayer = new MIDIPlayer(
            currentMidi,
            contextRef.current.sampleRate,
            postSynthMessage
          )

          iMuse.setMidiPlayer(newMidiPlayer)

          if (newCue.startOffset && newCue.startOffset > 0) {
            const totalDuration = getMidiDuration(currentMidi)
            const startRatio = newCue.startOffset / totalDuration
            console.log(
              `🚀 Fallback random cue starting from ${(
                startRatio * 100
              ).toFixed(1)}% (${newCue.startOffset} ticks)`
            )
            newMidiPlayer.seek(startRatio)
          }

          iMuse.playInitialCue(newCue)
          newMidiPlayer.resume()

          if (newCue.metadata?.entryIndex !== undefined) {
            setCurrentCueEntryIndex(newCue.metadata.entryIndex)
          }

          console.log("✅ Fallback random cue transition completed!")
        }
      }
    }
  }, [iMuse, pendingRandomCue, currentMidi])

  // ✅ Check progress on every progress update
  useEffect(() => {
    checkCueProgress()
  }, [iMuse.currentProgress, checkCueProgress])

  // Initialize audio system
  useEffect(() => {
    const initializeAudio = async () => {
      try {
        setLoadingStatus("Setting up audio context...")

        // Create audio context
        contextRef.current = new AudioContext()

        // Load AudioWorklet
        await contextRef.current.audioWorklet.addModule("js/processor.js")

        // Create synth
        synthRef.current = new AudioWorkletNode(
          contextRef.current,
          "synth-processor",
          {
            numberOfInputs: 0,
            outputChannelCount: [2],
          } as any
        )
        synthRef.current.connect(contextRef.current.destination)

        setLoadingStatus("Loading SoundFont...")

        // Load SoundFont
        const soundFontData = await (await fetch(soundFontUrl)).arrayBuffer()
        console.log(`SoundFont loaded: ${soundFontData.byteLength} bytes`)

        setLoadingStatus("Parsing SoundFont...")

        const sampleEvents = getSampleEventsFromSoundFont(
          new Uint8Array(soundFontData)
        )
        console.log("SoundFont parsed successfully")

        // ✅ NEW: Perform SoundFont analysis
        try {
          const soundFontAnalysisResult = analyzeSoundFont(sampleEvents)
          setSoundFontAnalysis(soundFontAnalysisResult)

          // If analysis returned empty results, create a fallback with GM instruments
          if (soundFontAnalysisResult.totalInstruments === 0) {
            console.log("🎯 Creating fallback GM instrument analysis...")
            const fallbackAnalysis = {
              totalInstruments: 128,
              totalSamples: sampleEvents.length,
              instruments: Array.from({ length: 128 }, (_, i) => ({
                program: i,
                name: getInstrumentName(i),
                bank: 0,
                samples: [],
              })),
              samples: sampleEvents.map((eventWrapper, index) => {
                const event = eventWrapper.event as any
                return {
                  name: event?.name || event?.sampleID || `Sample_${index}`,
                  size: event?.data?.length || event?.sample?.length || 0,
                  sampleRate: event?.sampleRate || 44100,
                  channels: event?.channels || 1,
                }
              }),
              totalSampleSize: sampleEvents.reduce((total, eventWrapper) => {
                const event = eventWrapper.event as any
                return (
                  total + (event?.data?.length || event?.sample?.length || 0)
                )
              }, 0),
            }
            setSoundFontAnalysis(fallbackAnalysis)
            console.log("✅ Fallback GM analysis created:", fallbackAnalysis)
          }
        } catch (error) {
          console.warn(
            "⚠️ SoundFont analysis failed, continuing without analysis:",
            error
          )
        }

        // Send samples to synth
        let sequenceNumber = 0
        for (const event of sampleEvents) {
          synthRef.current.port.postMessage(
            { ...event.event, sequenceNumber: sequenceNumber++ },
            event.transfer ?? []
          )
        }

        // Setup MIDI input
        try {
          const midiAccess = await (navigator as any).requestMIDIAccess({
            sysex: false,
          })
          midiAccess.inputs.forEach((entry: any) => {
            entry.onmidimessage = (event: any) => {
              // MIDI input temporarily disabled - Stream class import issue needs to be resolved
              console.log("MIDI input received:", event.data)
            }
          })
          console.log("MIDI input initialized (temporarily disabled)")
        } catch (e) {
          console.warn("MIDI input not available:", e)
        }

        setSoundFontLoaded(true)
        setLoadingStatus("Ready!")
      } catch (error) {
        console.error("Failed to initialize audio:", error)
        setLoadingStatus(`Error: ${error}`)
      }
    }

    initializeAudio()
  }, [getInstrumentName])

  return (
    <ErrorBoundary
      onError={(error: Error, errorInfo: ErrorInfo) => {
        console.error("🚨 Main App Error:", error, errorInfo)
        // Could send to error reporting service here
      }}
      resetKeys={[soundFontLoaded.toString(), loadedCuesData.length.toString()]}
    >
      <div className="app">
        <header className="app-header">
          <h1>🎵 Enhanced iMuse Adaptive Music System</h1>
          <p>Intelligent musical transitions with React hooks</p>
        </header>

        <main className="app-main">
          {/* Status */}
          <ErrorBoundary
            fallback={
              <div className="status-fallback">
                <h3>⚠️ Status Display Error</h3>
                <p>
                  Unable to display system status. Core functionality may still
                  work.
                </p>
              </div>
            }
          >
            <StatusSection
              soundFontLoaded={soundFontLoaded}
              loadingStatus={loadingStatus}
              cuesLoaded={loadedCuesData.length}
            />
          </ErrorBoundary>

          {/* iMuse Status */}
          <ErrorBoundary
            fallback={
              <div className="imuse-fallback">
                <h3>⚠️ iMuse Status Error</h3>
                <p>
                  Unable to display playback status. Audio system may still be
                  functional.
                </p>
              </div>
            }
          >
            <IMuseStatus
              currentCue={iMuse.currentCue}
              pendingCue={iMuse.pendingCue}
              pendingRandomCue={pendingRandomCue}
              transitionStatus={iMuse.transitionStatus}
            />
          </ErrorBoundary>

          {/* ✅ NEW: Analysis & Instrument Controls */}
          <ErrorBoundary
            fallback={
              <div className="analysis-fallback">
                <h3>⚠️ Analysis System Error</h3>
                <p>
                  Analysis and instrument controls are temporarily unavailable.
                </p>
                <button onClick={() => window.location.reload()}>
                  🔄 Reload App
                </button>
              </div>
            }
          >
            <div className="analysis-section">
              <div className="analysis-header">
                <h3>🔍 Analysis & Instruments</h3>
                <button onClick={toggleAnalysis} className="toggle-button">
                  {showAnalysis ? "▼ Hide" : "▶ Show"} Analysis
                </button>
              </div>

              {showAnalysis && (
                <div className="analysis-content">
                  {/* Analysis Tabs */}
                  <div className="analysis-tabs">
                    <button
                      className={
                        selectedAnalysisTab === "midi"
                          ? "tab-active"
                          : "tab-inactive"
                      }
                      onClick={() => handleTabChange("midi")}
                    >
                      📄 MIDI Analysis
                    </button>
                    <button
                      className={
                        selectedAnalysisTab === "soundfont"
                          ? "tab-active"
                          : "tab-inactive"
                      }
                      onClick={() => handleTabChange("soundfont")}
                    >
                      🎹 SoundFont Analysis
                    </button>
                    <button
                      className={
                        selectedAnalysisTab === "instruments"
                          ? "tab-active"
                          : "tab-inactive"
                      }
                      onClick={() => handleTabChange("instruments")}
                    >
                      🎼 Instrument Control
                    </button>
                    <button
                      className={
                        selectedAnalysisTab === "transitions"
                          ? "tab-active"
                          : "tab-inactive"
                      }
                      onClick={() => handleTabChange("transitions")}
                    >
                      🧠 Smart Transitions
                    </button>
                    <button
                      className={
                        selectedAnalysisTab === "layers"
                          ? "tab-active"
                          : "tab-inactive"
                      }
                      onClick={() => handleTabChange("layers")}
                    >
                      🎛️ Layer Management
                    </button>
                  </div>

                  {/* MIDI Analysis Tab */}
                  {selectedAnalysisTab === "midi" && midiAnalysis && (
                    <ErrorBoundary
                      fallback={<div>⚠️ MIDI analysis display error</div>}
                    >
                      <div className="analysis-tab-content">
                        <h4>📄 MIDI File Analysis</h4>
                        <div className="analysis-grid">
                          <div className="analysis-item">
                            <strong>Format:</strong> Type {midiAnalysis.format}
                          </div>
                          <div className="analysis-item">
                            <strong>Tracks:</strong> {midiAnalysis.tracks}
                          </div>
                          <div className="analysis-item">
                            <strong>Ticks/Beat:</strong>{" "}
                            {midiAnalysis.ticksPerBeat}
                          </div>
                          <div className="analysis-item">
                            <strong>Duration:</strong> {midiAnalysis.duration}{" "}
                            ticks
                          </div>
                          <div className="analysis-item">
                            <strong>Tempo:</strong>{" "}
                            {midiAnalysis.tempo?.toFixed(1) || "Unknown"} BPM
                          </div>
                          <div className="analysis-item">
                            <strong>Channels:</strong>{" "}
                            {Array.from(
                              midiAnalysis.channels as Set<number>
                            ).join(", ")}
                          </div>
                        </div>

                        <h5>📊 Event Summary</h5>
                        <div className="analysis-grid">
                          <div className="analysis-item">
                            <strong>Total Notes:</strong>{" "}
                            {midiAnalysis.totalNotes}
                          </div>
                          <div className="analysis-item">
                            <strong>Control Changes:</strong>{" "}
                            {midiAnalysis.totalControlChanges}
                          </div>
                          <div className="analysis-item">
                            <strong>Program Changes:</strong>{" "}
                            {midiAnalysis.totalProgramChanges}
                          </div>
                        </div>

                        <h5>🎵 Track Details</h5>
                        <div className="track-details">
                          {(midiAnalysis.trackDetails || []).map(
                            (track: any, index: number) => (
                              <div key={index} className="track-item">
                                <strong>Track {track.index}:</strong>{" "}
                                {track.events} events, {track.notes} notes
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </ErrorBoundary>
                  )}

                  {/* SoundFont Analysis Tab */}
                  {selectedAnalysisTab === "soundfont" && soundFontAnalysis && (
                    <ErrorBoundary
                      fallback={<div>⚠️ SoundFont analysis display error</div>}
                    >
                      <div className="analysis-tab-content">
                        <h4>🎹 SoundFont Analysis</h4>
                        <div className="analysis-grid">
                          <div className="analysis-item">
                            <strong>Total Instruments:</strong>{" "}
                            {soundFontAnalysis.totalInstruments}
                          </div>
                          <div className="analysis-item">
                            <strong>Total Samples:</strong>{" "}
                            {soundFontAnalysis.totalSamples}
                          </div>
                          <div className="analysis-item">
                            <strong>Sample Size:</strong>{" "}
                            {(
                              soundFontAnalysis.totalSampleSize /
                              1024 /
                              1024
                            ).toFixed(1)}{" "}
                            MB
                          </div>
                        </div>

                        <h5>🎼 Available Instruments</h5>
                        <div className="instrument-grid">
                          {soundFontAnalysis.instruments
                            .slice(0, 20)
                            .map((instrument: any) => (
                              <div
                                key={instrument.program}
                                className="instrument-item"
                              >
                                <strong>{instrument.program}:</strong>{" "}
                                {instrument.name}
                              </div>
                            ))}
                          {soundFontAnalysis.instruments.length > 20 && (
                            <div className="instrument-item">
                              <em>
                                ... and{" "}
                                {soundFontAnalysis.instruments.length - 20} more
                              </em>
                            </div>
                          )}
                        </div>
                      </div>
                    </ErrorBoundary>
                  )}

                  {/* Instrument Control Tab */}
                  {selectedAnalysisTab === "instruments" && (
                    <ErrorBoundary
                      fallback={<div>⚠️ Instrument controls error</div>}
                    >
                      <div className="analysis-tab-content">
                        <h4>🎼 Instrument Control</h4>

                        {midiAnalysis && midiAnalysis.channels.size > 0 ? (
                          <div className="instrument-controls">
                            <h4>🎼 Live Instrument Selector</h4>
                            <p>
                              Change instruments for each MIDI channel in
                              real-time:
                            </p>
                            {Array.from(
                              midiAnalysis.channels as Set<number>
                            ).map((channel: number) => (
                              <div key={channel} className="channel-control">
                                <label>Channel {channel}:</label>
                                <select
                                  value={currentInstruments[channel] || 0}
                                  onChange={(e) =>
                                    changeInstrument(
                                      channel,
                                      parseInt(e.target.value)
                                    )
                                  }
                                >
                                  {GM_INSTRUMENTS.map((instrument, index) => (
                                    <option key={index} value={index}>
                                      {instrument}
                                    </option>
                                  ))}
                                </select>
                                <span className="current-instrument">
                                  {getInstrumentName(
                                    currentInstruments[channel] || 0
                                  )}
                                </span>
                              </div>
                            ))}

                            <div className="preset-buttons">
                              <button onClick={presetHandlers.allPiano}>
                                All Piano
                              </button>
                              <button onClick={presetHandlers.allStrings}>
                                All Strings
                              </button>
                              <button onClick={presetHandlers.allWinds}>
                                All Winds
                              </button>
                              <button onClick={presetHandlers.randomizeAll}>
                                Randomize All
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p>No active MIDI channels found.</p>
                        )}
                      </div>
                    </ErrorBoundary>
                  )}

                  {/* Smart Transitions Tab */}
                  {selectedAnalysisTab === "transitions" && (
                    <ErrorBoundary
                      fallback={
                        <div className="transitions-fallback">
                          <h4>⚠️ Smart Transitions Error</h4>
                          <p>Smart transitions are temporarily unavailable.</p>
                          <p>You can still use the basic playback controls.</p>
                        </div>
                      }
                    >
                      <div className="analysis-tab-content">
                        <SmartTransitions
                          currentCue={iMuse.currentCue}
                          availableCues={
                            availableCues.length > 0
                              ? availableCues
                              : iMuse.currentCue
                              ? [iMuse.currentCue]
                              : []
                          }
                          smartTransition={iMuse.smartTransition}
                          transitionStatus={iMuse.transitionStatus}
                          isPlaying={iMuse.isPlaying}
                        />
                      </div>
                    </ErrorBoundary>
                  )}

                  {/* Layer Management Tab */}
                  {selectedAnalysisTab === "layers" && (
                    <ErrorBoundary
                      fallback={
                        <div className="layers-fallback">
                          <h4>⚠️ Layer Management Error</h4>
                          <p>
                            Layer management controls are temporarily
                            unavailable.
                          </p>
                          <p>Audio playback should continue normally.</p>
                        </div>
                      }
                    >
                      <div className="analysis-tab-content">
                        <LayerManagement
                          fadeInLayer={iMuse.fadeInLayer}
                          fadeOutLayer={iMuse.fadeOutLayer}
                          adjustLayersBasedOnUserActions={
                            iMuse.adjustLayersBasedOnUserActions
                          }
                          isPlaying={iMuse.isPlaying}
                          currentInstruments={currentInstruments}
                        />
                      </div>
                    </ErrorBoundary>
                  )}
                </div>
              )}
            </div>
          </ErrorBoundary>

          {/* Controls */}
          <AudioErrorBoundary
            onError={(error, errorInfo) => {
              console.error("🎵 Audio Control Error:", error, errorInfo)
              // Stop audio playback on critical errors
              try {
                iMuse.stop()
              } catch (stopError) {
                console.warn("Could not stop audio:", stopError)
              }
            }}
          >
            <div className="controls-section">
              <h3>Controls</h3>

              {/* Example Loading */}
              <ErrorBoundary fallback={<div>⚠️ Loading controls error</div>}>
                <div className="button-group">
                  <button
                    onClick={handleLoadExample}
                    disabled={!soundFontLoaded}
                  >
                    🎲 Load Example MIDI (Random Cue)
                  </button>
                  <button
                    onClick={handleRandomCue}
                    disabled={!iMuse.currentCue}
                  >
                    ⏳ New Random Cue (Smart Transition)
                  </button>
                  <button
                    onClick={handleDebugTransition}
                    disabled={!iMuse.currentCue}
                  >
                    🧪 Debug: Immediate Transition
                  </button>
                </div>

                {/* ✅ NEW: User MIDI File Upload */}
                <div className="button-group">
                  <label htmlFor="midi-file-input" className="file-input-label">
                    📁 Load Your MIDI File
                  </label>
                  <input
                    id="midi-file-input"
                    type="file"
                    accept=".mid,.midi"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file && soundFontLoaded) {
                        handleLoadUserMidi(file)
                      }
                    }}
                    disabled={!soundFontLoaded}
                    style={{ display: "none" }}
                  />
                  <small
                    style={{
                      color: "#666",
                      fontSize: "12px",
                      display: "block",
                      marginTop: "5px",
                    }}
                  >
                    Upload a .mid or .midi file from your computer
                  </small>
                </div>

                <div className="button-group">
                  <button
                    onClick={handleSmartTransition}
                    disabled={!iMuse.currentCue}
                  >
                    🎼 Smart Transition
                  </button>
                </div>
              </ErrorBoundary>

              {/* Playback Controls */}
              <ErrorBoundary
                fallback={
                  <div className="playback-fallback">
                    <h4>⚠️ Playback Controls Error</h4>
                    <p>
                      Basic playback controls are unavailable. Try reloading the
                      page.
                    </p>
                  </div>
                }
              >
                <PlaybackControls
                  isPlaying={iMuse.isPlaying}
                  currentProgress={iMuse.currentProgress}
                  onPlay={iMuse.play}
                  onPause={iMuse.pause}
                  onStop={iMuse.stop}
                  onSeek={iMuse.seek}
                />
              </ErrorBoundary>

              {/* Tempo Controls */}
              <ErrorBoundary fallback={<div>⚠️ Tempo controls error</div>}>
                <TempoControls
                  userTempoOverride={iMuse.userTempoOverride}
                  originalFileTempo={iMuse.originalFileTempo}
                  onTempoChange={iMuse.setTempoMultiplier}
                  onTempoReset={iMuse.resetTempo}
                />
              </ErrorBoundary>

              {/* Transpose Controls */}
              <ErrorBoundary fallback={<div>⚠️ Transpose controls error</div>}>
                <TransposeControls
                  currentTranspose={iMuse.currentTranspose}
                  onTransposeChange={iMuse.setTranspose}
                  onTransposeReset={iMuse.resetTranspose}
                />
              </ErrorBoundary>

              {/* Reverb Controls */}
              <ErrorBoundary fallback={<div>⚠️ Reverb controls error</div>}>
                <ReverbControls
                  currentReverb={iMuse.currentReverb}
                  onReverbChange={handleReverbChange}
                  onReverbReset={iMuse.resetReverb}
                />
              </ErrorBoundary>
            </div>
          </AudioErrorBoundary>
        </main>

        {/* CSS Styles */}
        <style>{`
          .app {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            font-family: 'Courier New', monospace;
          }

          .app-header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            border: 2px solid #4CAF50;
            border-radius: 8px;
            background: #E8F5E8;
          }

          .app-header h1 {
            margin: 0 0 10px 0;
            color: #2E7D32;
          }

          .app-header p {
            margin: 0;
            color: #666;
          }

          .status-section,
          .imuse-status,
          .controls-section {
            margin: 20px 0;
            padding: 15px;
            border: 1px solid #ccc;
            border-radius: 4px;
            background: white;
          }

          /* ✅ NEW: Error Fallback Styles */
          .status-fallback,
          .imuse-fallback,
          .analysis-fallback,
          .transitions-fallback,
          .layers-fallback,
          .playback-fallback {
            padding: 15px;
            margin: 10px 0;
            border: 2px solid #f39c12;
            border-radius: 4px;
            background: #fef9e7;
            text-align: center;
          }

          .status-fallback h3,
          .imuse-fallback h3,
          .analysis-fallback h3,
          .transitions-fallback h4,
          .layers-fallback h4,
          .playback-fallback h4 {
            color: #f39c12;
            margin: 0 0 10px 0;
          }

          .status-fallback p,
          .imuse-fallback p,
          .analysis-fallback p,
          .transitions-fallback p,
          .layers-fallback p,
          .playback-fallback p {
            color: #666;
            margin: 5px 0;
          }

          .status-item,
          .current-cue,
          .pending-cue,
          .pending-random {
            margin: 5px 0;
          }

          .pending-random {
            color: #FF9800;
            font-weight: bold;
          }

          .transition-status {
            margin: 5px 0;
            padding: 5px;
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 3px;
            font-style: italic;
          }

          .button-group {
            display: flex;
            gap: 10px;
            margin: 10px 0;
            flex-wrap: wrap;
          }

          button {
            padding: 8px 16px;
            border: 1px solid #333;
            border-radius: 4px;
            background: #e0e0e0;
            cursor: pointer;
            font-family: monospace;
          }

          button:hover:not(:disabled) {
            background: #d0d0d0;
          }

          button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          /* ✅ NEW: File Input Label Styling */
          .file-input-label {
            display: inline-block;
            padding: 8px 16px;
            border: 1px solid #333;
            border-radius: 4px;
            background: #e0e0e0;
            cursor: pointer;
            font-family: monospace;
            text-align: center;
            transition: background-color 0.2s;
          }

          .file-input-label:hover {
            background: #d0d0d0;
          }

          .file-input-label:disabled,
          input:disabled + .file-input-label {
            opacity: 0.6;
            cursor: not-allowed;
            background: #f0f0f0;
          }

          .control-row,
          .progress-container {
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 10px 0;
          }

          .control-row input[type="range"],
          .progress-container input[type="range"] {
            flex: 1;
            min-width: 200px;
          }

          .value-display {
            min-width: 60px;
            text-align: center;
            font-weight: bold;
            color: #2196F3;
          }

          label {
            font-weight: bold;
            min-width: 80px;
          }

          h3, h4 {
            margin: 0 0 10px 0;
            color: #333;
          }

          .playback-controls,
          .tempo-controls,
          .transpose-controls {
            margin: 15px 0;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: #fafafa;
          }

          .playback-controls,
          .tempo-controls,
          .transpose-controls,
          .reverb-controls {
            margin: 15px 0;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: #fafafa;
          }

          .tempo-info,
          .transpose-info {
            margin-top: 5px;
            color: #666;
          }

          .tempo-info,
          .transpose-info,
          .reverb-info {
            margin-top: 5px;
            color: #666;
          }

          small {
            margin-left: 5px;
            color: #888;
          }

          /* ✅ NEW: Analysis & Instrument Control Styles */
          .analysis-section {
            margin: 20px 0;
            padding: 15px;
            border: 1px solid #ccc;
            border-radius: 4px;
            background: white;
          }

          .analysis-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
          }

          .toggle-button {
            padding: 5px 10px;
            font-size: 12px;
            border-radius: 3px;
            background: #f0f0f0;
          }

          .analysis-content {
            border-top: 1px solid #eee;
            padding-top: 15px;
          }

          .analysis-tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
            border-bottom: 1px solid #ddd;
          }

          .tab-active {
            padding: 8px 16px;
            border: none;
            border-bottom: 2px solid #2196F3;
            background: none;
            color: #2196F3;
            font-weight: bold;
            cursor: pointer;
          }

          .tab-inactive {
            padding: 8px 16px;
            border: none;
            background: none;
            color: #666;
            cursor: pointer;
          }

          .tab-inactive:hover {
            color: #333;
            background: #f5f5f5;
          }

          .analysis-tab-content {
            padding: 10px 0;
          }

          .analysis-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
            margin: 10px 0;
          }

          .analysis-item {
            padding: 8px;
            background: #f9f9f9;
            border: 1px solid #eee;
            border-radius: 3px;
            font-size: 14px;
          }

          .track-details {
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid #eee;
            border-radius: 3px;
            padding: 10px;
            background: #fafafa;
          }

          .track-item {
            margin: 5px 0;
            padding: 5px;
            font-size: 13px;
            border-left: 3px solid #2196F3;
            padding-left: 8px;
          }

          .instrument-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 8px;
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid #eee;
            border-radius: 3px;
            padding: 10px;
            background: #fafafa;
          }

          .instrument-item {
            padding: 5px 8px;
            background: white;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-size: 12px;
          }

          .instrument-controls {
            margin-top: 15px;
          }

          .channel-control {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
            padding: 8px;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            background: #f9f9f9;
          }

          .channel-control label {
            min-width: 80px;
            font-weight: bold;
          }

          .instrument-select {
            flex: 1;
            padding: 4px 8px;
            border: 1px solid #ccc;
            border-radius: 3px;
            background: white;
            min-width: 200px;
          }

          .current-instrument {
            font-size: 0.9em;
            color: #666;
            min-width: 150px;
          }

          .instrument-presets {
            margin-top: 20px;
            padding: 15px;
            border: 1px solid #d0d0d0;
            border-radius: 4px;
            background: #f5f5f5;
          }

          .instrument-presets h5 {
            margin-top: 0;
            margin-bottom: 10px;
            color: #333;
          }

          .preset-buttons {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          .preset-buttons button {
            padding: 8px 12px;
            border: 1px solid #007acc;
            border-radius: 4px;
            background: #007acc;
            color: white;
            cursor: pointer;
            font-size: 0.9em;
            transition: background 0.2s;
          }

          .preset-buttons button:hover {
            background: #005c99;
          }

          .preset-buttons button:active {
            background: #004080;
          }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}

export default App
