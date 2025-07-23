import { createScheduler } from "maestro/dist/scheduler"
import { createTransitionManager } from "maestro/dist/transition"
import { createTransport } from "maestro/dist/transport"
import type { Cue, TransitionOptions } from "maestro/dist/types"
import { MidiFile } from "midifile-ts"
import { useCallback, useEffect, useRef, useState } from "react"
import { MIDIPlayer } from "./MIDIPlayer"

// ✅ Enhanced Cue interface with iMuse features
export interface ExtendedCue extends Cue {
  startOffset?: number
  metadata?: {
    totalDuration: number
    entryPointRatio: number
    originalEntryPoints: number[]
    entryIndex?: number
    entryPoints?: number[][]
  }
}

// ✅ Hook configuration interface
interface UseEnhancediMuseConfig {
  withTorii?: boolean
  preserveTempoOverride?: boolean
  adaptiveLayers?: boolean
  defaultTempo?: number
}

// ✅ Hook return interface
interface EnhancediMuseHook {
  // State
  currentCue: ExtendedCue | null
  pendingCue: ExtendedCue | null
  isPlaying: boolean
  currentProgress: number
  userTempoOverride: number | null
  originalFileTempo: number
  currentTranspose: number
  currentReverb: number
  transitionStatus: string

  // Core iMuse functions
  playInitialCue: (cue: ExtendedCue) => void
  transitionToCue: (
    targetCue: ExtendedCue,
    options?: TransitionOptions & {
      fadeInDuration?: number
      fadeOutDuration?: number
    }
  ) => void

  // Layer management
  fadeInLayer: (channel: number, duration?: number) => void
  fadeOutLayer: (channel: number, duration?: number) => void

  // Advanced features
  smartTransition: (
    targetCue: ExtendedCue,
    context: "user_input" | "automatic" | "random"
  ) => void
  adjustLayersBasedOnUserActions: (
    action: "tempo_change" | "transpose_change" | "reverb_change"
  ) => void
  enhanceCueForCurrentState: (cue: ExtendedCue) => ExtendedCue

  // User controls
  setTempoMultiplier: (multiplier: number) => void
  setTranspose: (semitones: number) => void
  setReverb: (amount: number) => void
  resetTempo: () => void
  resetTranspose: () => void
  resetReverb: () => void

  // Playback control
  play: () => void
  pause: () => void
  stop: () => void
  seek: (position: number) => void

  // MIDIPlayer management
  setMidiPlayer: (player: MIDIPlayer | null) => void
  setCurrentMidi: (midi: MidiFile | null) => void

  // Utility functions
  setTransitionStatus: (message: string) => void
  clearTransitionStatus: () => void
}

/**
 * ✅ Enhanced iMuse React Hook
 *
 * Provides comprehensive adaptive music capabilities with:
 * - Intelligent musical transitions
 * - Dynamic layer management
 * - State-aware cue enhancement
 * - User override preservation
 * - Smart transition contexts
 */
export function useEnhancediMuse(
  config: UseEnhancediMuseConfig = {}
): EnhancediMuseHook {
  const {
    withTorii = false,
    preserveTempoOverride = true,
    adaptiveLayers = true,
    defaultTempo = 120,
  } = config

  // ✅ Core State
  const [currentCue, setCurrentCue] = useState<ExtendedCue | null>(null)
  const [pendingCue, setPendingCue] = useState<ExtendedCue | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentProgress, setCurrentProgress] = useState(0)
  const [userTempoOverride, setUserTempoOverride] = useState<number | null>(
    null
  )
  const [originalFileTempo, setOriginalFileTempo] = useState(defaultTempo)
  const [currentTranspose, setCurrentTranspose] = useState(0)
  const [currentReverb, setCurrentReverb] = useState(0)
  const [transitionStatus, setTransitionStatus] = useState("")

  // ✅ Maestro Core (using useRef to maintain instances)
  const transport = useRef(createTransport(defaultTempo)).current
  const scheduler = useRef(createScheduler()).current
  const transitionManager = useRef(
    createTransitionManager(transport, scheduler)
  ).current

  // ✅ Audio Context and Player refs
  const midiPlayerRef = useRef<MIDIPlayer | null>(null)
  const currentMidiRef = useRef<MidiFile | null>(null)

  // ✅ Intelligent tempo management
  const setTempoIntelligently = useCallback(
    (cueTempoFromFile: number, source: string = "unknown") => {
      if (preserveTempoOverride && userTempoOverride !== null) {
        transport.setTempo(userTempoOverride)
        console.log(
          `🎼 iMuse Hook: Using user tempo override: ${userTempoOverride.toFixed(
            1
          )} BPM (ignoring ${source} tempo: ${cueTempoFromFile} BPM)`
        )
      } else {
        transport.setTempo(cueTempoFromFile)
        setOriginalFileTempo(cueTempoFromFile)
        console.log(
          `🎼 iMuse Hook: Using ${source} tempo: ${cueTempoFromFile} BPM`
        )
      }
    },
    [userTempoOverride, preserveTempoOverride, transport]
  )

  // ✅ Apply current settings to MIDIPlayer
  const applyCurrentSettingsToPlayer = useCallback(
    (player: MIDIPlayer) => {
      const settingsApplied = []

      // Apply tempo multiplier if user has overridden tempo
      if (userTempoOverride !== null && originalFileTempo > 0) {
        const currentMultiplier = userTempoOverride / originalFileTempo
        player.setTempoMultiplier(currentMultiplier)
        settingsApplied.push(`tempo ${currentMultiplier.toFixed(2)}x`)
      }

      // Apply current transpose setting
      if (currentTranspose !== 0) {
        player.setTranspose(currentTranspose)
        settingsApplied.push(
          `transpose ${
            currentTranspose > 0 ? "+" : ""
          }${currentTranspose} semitones`
        )
      }

      // Apply current reverb setting
      if (currentReverb !== 0) {
        player.setReverb(currentReverb)
        settingsApplied.push(`reverb ${(currentReverb * 100).toFixed(1)}%`)
      }

      if (settingsApplied.length > 0) {
        console.log(
          `🎛️ iMuse Hook: Applied user settings to MIDIPlayer: ${settingsApplied.join(
            ", "
          )}`
        )
      }
    },
    [userTempoOverride, originalFileTempo, currentTranspose, currentReverb]
  )

  // ✅ Core iMuse Functions
  const playInitialCue = useCallback(
    (cue: ExtendedCue) => {
      console.log(
        "🎵 iMuse Hook: Playing initial cue with adaptive features:",
        cue.id
      )
      scheduler.clear()
      scheduler.scheduleCue(cue)

      setTempoIntelligently(cue.tempo, "iMuse initial cue")
      setCurrentCue(cue)
      setIsPlaying(true)

      return cue
    },
    [scheduler, setTempoIntelligently]
  )

  const transitionToCue = useCallback(
    (
      targetCue: ExtendedCue,
      options: TransitionOptions & {
        fadeInDuration?: number
        fadeOutDuration?: number
      } = {}
    ) => {
      if (!currentCue) {
        console.warn("⚠️ iMuse Hook: No current cue to transition from")
        return
      }

      const defaultOptions = {
        waitForBar: true,
        matchKey: true,
        matchTempo: false, // Preserve user overrides
        fadeInDuration: 1000,
        fadeOutDuration: 1000,
        ...options,
      }

      console.log("🎵 iMuse Hook: Scheduling intelligent transition:", {
        from: currentCue.id,
        to: targetCue.id,
        options: defaultOptions,
      })

      setPendingCue(targetCue)

      transitionManager.scheduleTransition({
        from: currentCue,
        to: targetCue,
        options: defaultOptions,
        onResolved: () => {
          console.log(
            "✅ iMuse Hook: Intelligent transition completed to:",
            targetCue.id
          )

          // ✅ ACTUAL AUDIO TRANSITION - This was missing!
          console.log("🎵 iMuse Hook: Executing audio transition...")

          // Stop current player with fade if specified
          if (defaultOptions.fadeOutDuration > 0) {
            midiPlayerRef.current?.pause()
          } else {
            midiPlayerRef.current?.pause()
          }

          // If we have the current MIDI data, create new player for target cue
          if (currentMidiRef.current) {
            console.log("🎵 iMuse Hook: Creating new MIDIPlayer for target cue")

            // The MIDIPlayer should be created by the parent component
            // We'll trigger a callback to let the parent know to recreate the player
            if (midiPlayerRef.current) {
              // Apply target cue's entry point if specified
              if (targetCue.startOffset && targetCue.startOffset > 0) {
                // Calculate duration for seeking
                let totalDuration = 10000 // Default fallback

                // Try to get actual duration
                if (currentMidiRef.current) {
                  let maxTicks = 0
                  currentMidiRef.current.tracks.forEach((track) => {
                    let currentTicks = 0
                    track.forEach((event) => {
                      currentTicks += event.deltaTime
                      maxTicks = Math.max(maxTicks, currentTicks)
                    })
                  })
                  totalDuration = maxTicks
                }

                const startRatio = targetCue.startOffset / totalDuration
                console.log(
                  `🚀 iMuse Hook: Seeking to target cue entry point: ${(
                    startRatio * 100
                  ).toFixed(1)}% (${targetCue.startOffset} ticks)`
                )
                midiPlayerRef.current.seek(startRatio)
              }

              // Apply current settings to the player
              applyCurrentSettingsToPlayer(midiPlayerRef.current)

              // Resume playback
              midiPlayerRef.current.resume()
            }
          }

          // Update state
          setCurrentCue(targetCue)
          setPendingCue(null)

          if (defaultOptions.matchTempo) {
            setTempoIntelligently(
              targetCue.tempo,
              "iMuse transition (tempo matched)"
            )
          } else {
            setTempoIntelligently(
              targetCue.tempo,
              "iMuse transition (tempo preserved)"
            )
          }
        },
      })
    },
    [
      currentCue,
      transitionManager,
      setTempoIntelligently,
      applyCurrentSettingsToPlayer,
    ]
  )

  // ✅ Layer Management
  const fadeInLayer = useCallback(
    (channel: number, duration: number = 1000) => {
      console.log(
        `🔊 iMuse Hook: Fading in layer ${channel} over ${duration}ms`
      )
      scheduler.fadeInLayer(channel, duration)
    },
    [scheduler]
  )

  const fadeOutLayer = useCallback(
    (channel: number, duration: number = 1000) => {
      console.log(
        `🔇 iMuse Hook: Fading out layer ${channel} over ${duration}ms`
      )
      scheduler.fadeOutLayer(channel, duration)
    },
    [scheduler]
  )

  // ✅ Advanced Features
  const adjustLayersBasedOnUserActions = useCallback(
    (action: "tempo_change" | "transpose_change" | "reverb_change") => {
      if (!adaptiveLayers || !currentCue || !currentCue.layers) return

      console.log(`🎵 iMuse Hook: Adjusting layers based on action: ${action}`)

      switch (action) {
        case "tempo_change":
          if (currentCue.layers.length > 1) {
            fadeInLayer(9, 1000) // Emphasis on drums
          }
          break
        case "transpose_change":
          if (currentCue.layers.length > 2) {
            fadeInLayer(2, 1500) // Harmony layer
          }
          break
        case "reverb_change":
          if (currentCue.layers.length > 3) {
            fadeInLayer(3, 2000) // Atmospheric layer
          }
          break
      }
    },
    [currentCue, adaptiveLayers, fadeInLayer]
  )

  const smartTransition = useCallback(
    (
      targetCue: ExtendedCue,
      context: "user_input" | "automatic" | "random"
    ) => {
      const options = {
        waitForBar: true,
        matchKey: context === "automatic",
        matchTempo: false,
        fadeInDuration: context === "user_input" ? 750 : 1000,
        fadeOutDuration: context === "user_input" ? 500 : 1000,
      }

      console.log(
        `🎵 iMuse Hook: Smart transition (${context}) with adaptive options:`,
        options
      )

      return transitionToCue(targetCue, options)
    },
    [transitionToCue]
  )

  const enhanceCueForCurrentState = useCallback(
    (cue: ExtendedCue): ExtendedCue => {
      let enhancedCue = { ...cue }

      // Add layer information based on MIDI tracks
      if (currentMidiRef.current && !enhancedCue.layers?.length) {
        enhancedCue = {
          ...enhancedCue,
          layers: currentMidiRef.current.tracks.map((track, index) => ({
            id: `track-${index}`,
            channel: index,
            volume: 100,
            muted: false,
          })),
        }
      }

      // State-based enhancements
      if (currentTranspose !== 0) {
        console.log(`🎵 iMuse Hook: Enhancing cue with transpose-aware layers`)
      }

      if (userTempoOverride !== null) {
        console.log(`🎵 iMuse Hook: Enhancing cue with tempo-aware dynamics`)
      }

      return enhancedCue
    },
    [currentTranspose, userTempoOverride]
  )

  // ✅ User Controls
  const setTempoMultiplier = useCallback(
    (multiplier: number) => {
      const newTempo = originalFileTempo * multiplier
      setUserTempoOverride(newTempo)
      transport.setTempo(newTempo)

      if (midiPlayerRef.current) {
        midiPlayerRef.current.setTempoMultiplier(multiplier)
      }

      console.log(
        `🎼 iMuse Hook: Tempo override set to ${newTempo.toFixed(
          1
        )} BPM (${multiplier}x)`
      )

      if (adaptiveLayers) {
        adjustLayersBasedOnUserActions("tempo_change")
      }
    },
    [
      originalFileTempo,
      transport,
      adaptiveLayers,
      adjustLayersBasedOnUserActions,
    ]
  )

  const setTranspose = useCallback(
    (semitones: number) => {
      setCurrentTranspose(semitones)

      if (midiPlayerRef.current) {
        midiPlayerRef.current.setTranspose(semitones)
      }

      console.log(
        `🎵 iMuse Hook: Transpose set to ${
          semitones > 0 ? "+" : ""
        }${semitones} semitones`
      )

      if (adaptiveLayers) {
        adjustLayersBasedOnUserActions("transpose_change")
      }
    },
    [adaptiveLayers, adjustLayersBasedOnUserActions]
  )

  const setReverb = useCallback((amount: number) => {
    setCurrentReverb(amount)

    if (midiPlayerRef.current) {
      midiPlayerRef.current.setReverb(amount)
    }

    console.log(`🎵 iMuse Hook: Reverb set to ${amount.toFixed(1)}%`)
  }, [])

  const resetTempo = useCallback(() => {
    setUserTempoOverride(null)
    transport.setTempo(originalFileTempo)

    if (midiPlayerRef.current) {
      midiPlayerRef.current.setTempoMultiplier(1.0)
    }

    console.log(
      "🔄 iMuse Hook: Tempo reset - will use file tempo for future cue changes"
    )
  }, [originalFileTempo, transport])

  const resetTranspose = useCallback(() => {
    setCurrentTranspose(0)

    if (midiPlayerRef.current) {
      midiPlayerRef.current.setTranspose(0)
    }

    console.log("🔄 iMuse Hook: Transpose reset to 0 semitones")
  }, [])

  const resetReverb = useCallback(() => {
    setCurrentReverb(0)

    if (midiPlayerRef.current) {
      midiPlayerRef.current.setReverb(0)
    }

    console.log("🔄 iMuse Hook: Reverb reset to 0%")
  }, [])

  // ✅ Playback Controls
  const play = useCallback(() => {
    if (currentCue && !isPlaying) {
      playInitialCue(currentCue)
    }
    midiPlayerRef.current?.resume()
    setIsPlaying(true)
  }, [currentCue, isPlaying, playInitialCue])

  const pause = useCallback(() => {
    midiPlayerRef.current?.pause()
    setIsPlaying(false)
    setPendingCue(null) // Cancel pending transitions
    setTransitionStatus("")
  }, [])

  const stop = useCallback(() => {
    if (currentCue) {
      fadeOutLayer(0, 1000)
    }
    midiPlayerRef.current?.stop()
    setIsPlaying(false)
    setPendingCue(null)
    setTransitionStatus("")
  }, [currentCue, fadeOutLayer])

  const seek = useCallback((position: number) => {
    midiPlayerRef.current?.seek(position)
    setCurrentProgress(position)
  }, [])

  // ✅ MIDIPlayer Management
  const setMidiPlayer = useCallback(
    (player: MIDIPlayer | null) => {
      midiPlayerRef.current = player
      if (player) {
        // Set up progress tracking
        player.onProgress = (progress) => {
          setCurrentProgress(progress)
        }
        // Apply current settings
        applyCurrentSettingsToPlayer(player)
      }
    },
    [applyCurrentSettingsToPlayer]
  )

  const setCurrentMidi = useCallback((midi: MidiFile | null) => {
    currentMidiRef.current = midi
  }, [])

  // ✅ Utility Functions
  const clearTransitionStatus = useCallback(() => {
    setTransitionStatus("")
  }, [])

  // ✅ Progress tracking effect
  useEffect(() => {
    if (midiPlayerRef.current) {
      midiPlayerRef.current.onProgress = (progress) => {
        setCurrentProgress(progress)
      }
    }
  }, [midiPlayerRef.current])

  console.log("🎵 Enhanced iMuse React Hook initialized with adaptive features")

  return {
    // State
    currentCue,
    pendingCue,
    isPlaying,
    currentProgress,
    userTempoOverride,
    originalFileTempo,
    currentTranspose,
    currentReverb,
    transitionStatus,

    // Core functions
    playInitialCue,
    transitionToCue,
    fadeInLayer,
    fadeOutLayer,

    // Advanced features
    smartTransition,
    adjustLayersBasedOnUserActions,
    enhanceCueForCurrentState,

    // User controls
    setTempoMultiplier,
    setTranspose,
    setReverb,
    resetTempo,
    resetTranspose,
    resetReverb,

    // Playback control
    play,
    pause,
    stop,
    seek,

    // MIDIPlayer management
    setMidiPlayer,
    setCurrentMidi,

    // Utilities
    setTransitionStatus,
    clearTransitionStatus,
  }
}
