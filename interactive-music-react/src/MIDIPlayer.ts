import { SynthEvent } from "@ryohey/wavelet"
import {
  AnyEvent,
  EndOfTrackEvent,
  MIDIControlEvents,
  MidiFile,
} from "midifile-ts"
import EventScheduler from "./EventScheduler"

interface Tick {
  tick: number
  track: number
}

function addTick(events: AnyEvent[], track: number): (AnyEvent & Tick)[] {
  let tick = 0
  return events.map((e) => {
    tick += e.deltaTime
    return { ...e, tick, track }
  })
}

export const isEndOfTrackEvent = (e: AnyEvent): e is EndOfTrackEvent =>
  "subtype" in e && e.subtype === "endOfTrack"

const TIMER_INTERVAL = 100
const LOOK_AHEAD_TIME = 50

export class MIDIPlayer {
  private output: (e: SynthEvent) => void
  private tempo = 120
  private baseTempo = 120
  private tempoMultiplier = 1.0
  private transpose = 0
  private reverb = 0.0
  private interval: number | undefined
  private midi: MidiFile
  private sampleRate: number
  private tickedEvents: (AnyEvent & Tick)[]
  private scheduler: EventScheduler<AnyEvent & Tick>
  private endOfSong: number
  onProgress?: (progress: number) => void

  constructor(
    midi: MidiFile,
    sampleRate: number,
    output: (e: SynthEvent) => void
  ) {
    this.midi = midi
    this.sampleRate = sampleRate
    this.output = output
    this.tickedEvents = midi.tracks
      .flatMap(addTick)
      .sort((a, b) => a.tick - b.tick)
    this.scheduler = new EventScheduler(
      this.tickedEvents,
      0,
      this.midi.header.ticksPerBeat,
      TIMER_INTERVAL + LOOK_AHEAD_TIME
    )
    this.endOfSong = Math.max(
      ...this.tickedEvents.filter(isEndOfTrackEvent).map((e) => e.tick)
    )
    this.resetControllers()
  }

  setTempoMultiplier(multiplier: number) {
    this.tempoMultiplier = multiplier
    console.log(
      `Tempo set to ${multiplier}x (${this.baseTempo * multiplier} BPM)`
    )
  }

  getTempoMultiplier(): number {
    return this.tempoMultiplier
  }

  setTranspose(semitones: number) {
    this.transpose = semitones
    console.log(
      `Transpose set to ${semitones >= 0 ? "+" : ""}${semitones} semitones`
    )
  }

  getTranspose(): number {
    return this.transpose
  }

  setReverb(amount: number) {
    this.reverb = Math.max(0, Math.min(1, amount))
    console.log(`Reverb set to ${(this.reverb * 100).toFixed(1)}%`)

    // Send reverb control event to synth
    this.output({
      type: "reverbControl",
      amount: this.reverb,
      delayTime: 0,
    })
  }

  getReverb(): number {
    return this.reverb
  }

  resume() {
    if (this.interval === undefined) {
      this.interval = window.setInterval(() => this.onTimer(), TIMER_INTERVAL)
    }
  }

  pause() {
    clearInterval(this.interval)
    this.interval = undefined
    this.allSoundsOff()
  }

  stop() {
    this.pause()
    this.resetControllers()
    this.scheduler.seek(0)
    this.onProgress?.(0)
  }

  // 0: start, 1: end
  seek(position: number) {
    this.allSoundsOff()
    this.scheduler.seek(position * this.endOfSong)
  }

  private allSoundsOff() {
    for (let i = 0; i < 16; i++) {
      this.output({
        type: "midi",
        midi: {
          type: "channel",
          subtype: "controller",
          controllerType: MIDIControlEvents.ALL_SOUNDS_OFF,
          channel: i,
          value: 0,
        },
        delayTime: 0,
      })
    }
  }

  private resetControllers() {
    for (let i = 0; i < 16; i++) {
      this.output({
        type: "midi",
        midi: {
          type: "channel",
          subtype: "controller",
          controllerType: MIDIControlEvents.RESET_CONTROLLERS,
          channel: i,
          value: 0,
        },
        delayTime: 0,
      })
    }
  }

  private onTimer() {
    const now = performance.now()
    const effectiveTempo = this.tempo * this.tempoMultiplier
    const events = this.scheduler.readNextEvents(effectiveTempo, now)

    // channel イベントを MIDI Output に送信
    // Send Channel Event to MIDI OUTPUT
    events.forEach(({ event, timestamp }) => {
      const delayTime = ((timestamp - now) / 1000) * this.sampleRate
      const synthEvent = this.handleEvent(event, delayTime)
      if (synthEvent !== null) {
        this.output(synthEvent)
      }
    })

    if (this.scheduler.currentTick >= this.endOfSong) {
      clearInterval(this.interval)
      this.interval = undefined
    }

    this.onProgress?.(this.scheduler.currentTick / this.endOfSong)
  }

  private handleEvent(
    e: AnyEvent & Tick,
    delayTime: number
  ): SynthEvent | null {
    switch (e.type) {
      case "channel":
        // Apply transpose to note events
        if (
          (e.subtype === "noteOn" || e.subtype === "noteOff") &&
          this.transpose !== 0
        ) {
          const transposedNote = Math.max(
            0,
            Math.min(127, e.noteNumber + this.transpose)
          )
          return {
            type: "midi",
            midi: {
              ...e,
              noteNumber: transposedNote,
            },
            delayTime,
          }
        }
        return {
          type: "midi",
          midi: e,
          delayTime,
        }
      case "meta":
        switch (e.subtype) {
          case "setTempo":
            this.baseTempo = (60 * 1000000) / e.microsecondsPerBeat
            this.tempo = this.baseTempo
            break
          case "endOfTrack":
          case "trackName":
          case "instrumentName":
          case "text":
          case "copyrightNotice":
          case "marker":
          case "cuePoint":
          case "lyrics":
          case "timeSignature":
          case "keySignature":
          case "portPrefix":
          case "sequencerSpecific":
          case "smpteOffset":
          case "sequenceNumber":
            // These are common meta events that we don't need to process but shouldn't warn about
            break
          default:
            // Only warn about truly unknown meta events, and do it less verbosely
            console.debug(`Unsupported meta event: ${e.subtype}`)
            break
        }
    }
    return null
  }
}
