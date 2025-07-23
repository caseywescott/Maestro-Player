(function () {
    'use strict';

    // https://stackoverflow.com/a/61339321/1567777
    class FastSleep {
        channel = new MessageChannel();
        promiseResolver;
        constructor() {
            this.channel.port2.onmessage = () => {
                this.promiseResolver?.();
            };
        }
        async wait() {
            const promise = new Promise((resolve) => {
                this.promiseResolver = resolve;
            });
            this.channel.port1.postMessage(null);
            await promise;
        }
    }

    /**
     * This is a custom implementation of Math.max to prevent call stack size exceeded error
     *   when using Math.max(...arr).
     */
    function max(arr) {
        if (arr.length === 0) {
            return undefined;
        }
        let max = arr[0];
        for (let i = 1; i < arr.length; i++) {
            if (arr[i] > max) {
                max = arr[i];
            }
        }
        return max;
    }

    class Logger {
        enabled = true;
        log(...args) {
            if (this.enabled) {
                console.log(...args);
            }
        }
        warn(...args) {
            if (this.enabled) {
                console.warn(...args);
            }
        }
        error(...args) {
            if (this.enabled) {
                console.error(...args);
            }
        }
    }
    const logger = new Logger();
    logger.enabled = false;

    class ReverbProcessor {
        sampleRate;
        delayLines;
        delayIndices;
        delayTimes; // in samples
        feedbacks;
        gains;
        wetLevel = 0.0; // 0 to 1
        dryLevel = 1.0; // 0 to 1
        constructor(sampleRate) {
            this.sampleRate = sampleRate;
            // Create multiple delay lines for a richer reverb sound
            // These delay times create a simple but effective reverb
            const delayTimesMs = [19, 29, 41, 53, 67, 79, 97, 113]; // in milliseconds
            this.delayTimes = delayTimesMs.map((ms) => Math.floor((ms * sampleRate) / 1000));
            // Initialize delay lines
            this.delayLines = this.delayTimes.map((delayTime) => new Float32Array(delayTime));
            this.delayIndices = new Array(this.delayTimes.length).fill(0);
            // Feedback and gain values for each delay line
            this.feedbacks = [0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35];
            this.gains = [0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45];
        }
        setReverb(amount) {
            // amount is 0 to 1
            this.wetLevel = Math.max(0, Math.min(1, amount));
            this.dryLevel = 1.0 - this.wetLevel * 0.7; // Keep some dry signal even at max reverb
        }
        process(leftInput, rightInput, leftOutput, rightOutput) {
            const bufferSize = leftInput.length;
            for (let i = 0; i < bufferSize; i++) {
                // Mix input channels for reverb processing
                const inputSample = (leftInput[i] + rightInput[i]) * 0.5;
                let reverbSample = 0;
                // Process through each delay line
                for (let d = 0; d < this.delayLines.length; d++) {
                    const delayLine = this.delayLines[d];
                    const delayIndex = this.delayIndices[d];
                    const delayTime = this.delayTimes[d];
                    // Read from delay line
                    const delayedSample = delayLine[delayIndex];
                    // Write to delay line with feedback
                    delayLine[delayIndex] = inputSample + delayedSample * this.feedbacks[d];
                    // Add to reverb output with gain
                    reverbSample += delayedSample * this.gains[d];
                    // Advance delay index
                    this.delayIndices[d] = (delayIndex + 1) % delayTime;
                }
                // Apply some filtering to make it sound more natural
                reverbSample *= 0.3; // Scale down the reverb
                // Mix dry and wet signals
                const dryLeft = leftInput[i] * this.dryLevel;
                const dryRight = rightInput[i] * this.dryLevel;
                const wetLeft = reverbSample * this.wetLevel;
                const wetRight = reverbSample * this.wetLevel;
                leftOutput[i] = dryLeft + wetLeft;
                rightOutput[i] = dryRight + wetRight;
            }
        }
    }

    class SampleTable {
        samples = {};
        sampleParameters = {};
        addSample(data, sampleID) {
            this.samples[sampleID] = data;
        }
        addSampleParameter(parameter, range) {
            const { bank, instrument, keyRange, velRange } = range;
            for (let i = keyRange[0]; i <= keyRange[1]; i++) {
                if (this.sampleParameters[bank] === undefined) {
                    this.sampleParameters[bank] = {};
                }
                if (this.sampleParameters[bank][instrument] === undefined) {
                    this.sampleParameters[bank][instrument] = {};
                }
                if (this.sampleParameters[bank][instrument][i] === undefined) {
                    this.sampleParameters[bank][instrument][i] = [];
                }
                this.sampleParameters[bank][instrument][i].push({
                    ...parameter,
                    velRange,
                });
            }
        }
        getSamples(bank, instrument, pitch, velocity) {
            const instrumentParameters = this.sampleParameters[bank]?.[instrument] ??
                this.sampleParameters[0]?.[instrument] ?? // fallback to bank 0
                null;
            const parameters = instrumentParameters?.[pitch]?.filter((s) => velocity >= s.velRange[0] && velocity <= s.velRange[1]) ?? [];
            const samples = [];
            for (const parameter of parameters) {
                const buffer = this.samples[parameter.sampleID];
                if (buffer === undefined) {
                    console.warn(`sample not found: ${parameter.sampleID}`);
                    continue;
                }
                samples.push({
                    ...parameter,
                    buffer,
                });
            }
            return samples;
        }
    }

    var MIDIControlEvents = {
        MSB_BANK: 0x00,
        MSB_MODWHEEL: 0x01,
        MSB_BREATH: 0x02,
        MSB_FOOT: 0x04,
        MSB_PORTAMENTO_TIME: 0x05,
        MSB_DATA_ENTRY: 0x06,
        MSB_MAIN_VOLUME: 0x07,
        MSB_BALANCE: 0x08,
        MSB_PAN: 0x0a,
        MSB_EXPRESSION: 0x0b,
        MSB_EFFECT1: 0x0c,
        MSB_EFFECT2: 0x0d,
        MSB_GENERAL_PURPOSE1: 0x10,
        MSB_GENERAL_PURPOSE2: 0x11,
        MSB_GENERAL_PURPOSE3: 0x12,
        MSB_GENERAL_PURPOSE4: 0x13,
        LSB_BANK: 0x20,
        LSB_MODWHEEL: 0x21,
        LSB_BREATH: 0x22,
        LSB_FOOT: 0x24,
        LSB_PORTAMENTO_TIME: 0x25,
        LSB_DATA_ENTRY: 0x26,
        LSB_MAIN_VOLUME: 0x27,
        LSB_BALANCE: 0x28,
        LSB_PAN: 0x2a,
        LSB_EXPRESSION: 0x2b,
        LSB_EFFECT1: 0x2c,
        LSB_EFFECT2: 0x2d,
        LSB_GENERAL_PURPOSE1: 0x30,
        LSB_GENERAL_PURPOSE2: 0x31,
        LSB_GENERAL_PURPOSE3: 0x32,
        LSB_GENERAL_PURPOSE4: 0x33,
        SUSTAIN: 0x40,
        PORTAMENTO: 0x41,
        SOSTENUTO: 0x42,
        SUSTENUTO: 0x42,
        SOFT_PEDAL: 0x43,
        LEGATO_FOOTSWITCH: 0x44,
        HOLD2: 0x45,
        SC1_SOUND_VARIATION: 0x46,
        SC2_TIMBRE: 0x47,
        SC3_RELEASE_TIME: 0x48,
        SC4_ATTACK_TIME: 0x49,
        SC5_BRIGHTNESS: 0x4a,
        SC6: 0x4b,
        SC7: 0x4c,
        SC8: 0x4d,
        SC9: 0x4e,
        SC10: 0x4f,
        GENERAL_PURPOSE5: 0x50,
        GENERAL_PURPOSE6: 0x51,
        GENERAL_PURPOSE7: 0x52,
        GENERAL_PURPOSE8: 0x53,
        PORTAMENTO_CONTROL: 0x54,
        E1_REVERB_DEPTH: 0x5b,
        E2_TREMOLO_DEPTH: 0x5c,
        E3_CHORUS_DEPTH: 0x5d,
        E4_DETUNE_DEPTH: 0x5e,
        E5_PHASER_DEPTH: 0x5f,
        DATA_INCREMENT: 0x60,
        DATA_DECREMENT: 0x61,
        NONREG_PARM_NUM_LSB: 0x62,
        NONREG_PARM_NUM_MSB: 0x63,
        REGIST_PARM_NUM_LSB: 0x64,
        REGIST_PARM_NUM_MSB: 0x65,
        ALL_SOUNDS_OFF: 0x78,
        RESET_CONTROLLERS: 0x79,
        LOCAL_CONTROL_SWITCH: 0x7a,
        ALL_NOTES_OFF: 0x7b,
        OMNI_OFF: 0x7c,
        OMNI_ON: 0x7d,
        MONO1: 0x7e,
        MONO2: 0x7f,
    };

    function toCharCodes(str) {
        var bytes = [];
        for (var i = 0; i < str.length; i++) {
            bytes.push(str.charCodeAt(i));
        }
        return bytes;
    }

    /** @class */ ((function () {
        function Buffer() {
            this.data = [];
            this.position = 0;
        }
        Object.defineProperty(Buffer.prototype, "length", {
            get: function () {
                return this.data.length;
            },
            enumerable: false,
            configurable: true
        });
        Buffer.prototype.writeByte = function (v) {
            this.data.push(v);
            this.position++;
        };
        Buffer.prototype.writeStr = function (str) {
            this.writeBytes(toCharCodes(str));
        };
        Buffer.prototype.writeInt32 = function (v) {
            this.writeByte((v >> 24) & 0xff);
            this.writeByte((v >> 16) & 0xff);
            this.writeByte((v >> 8) & 0xff);
            this.writeByte(v & 0xff);
        };
        Buffer.prototype.writeInt16 = function (v) {
            this.writeByte((v >> 8) & 0xff);
            this.writeByte(v & 0xff);
        };
        Buffer.prototype.writeBytes = function (arr) {
            var _this = this;
            arr.forEach(function (v) { return _this.writeByte(v); });
        };
        Buffer.prototype.writeChunk = function (id, func) {
            this.writeStr(id);
            var chunkBuf = new Buffer();
            func(chunkBuf);
            this.writeInt32(chunkBuf.length);
            this.writeBytes(chunkBuf.data);
        };
        Buffer.prototype.toBytes = function () {
            return new Uint8Array(this.data);
        };
        return Buffer;
    })());

    class SynthEventHandler {
        processor;
        rpnEvents = {};
        bankSelectMSB = {};
        constructor(processor) {
            this.processor = processor;
        }
        handleImmediateEvent(e) {
            switch (e.type) {
                case "sampleParameter":
                    this.processor.addSampleParameter(e.parameter, e.range);
                    break;
                case "loadSample":
                    this.processor.addSample(e.data, e.sampleID);
                    break;
                case "reverbControl":
                    this.processor.setReverb(e.amount);
                    break;
            }
        }
        handleDelayableEvent(e) {
            logger.log("handle delayable event", e);
            switch (e.type) {
                case "channel": {
                    switch (e.subtype) {
                        case "noteOn":
                            this.processor.noteOn(e.channel, e.noteNumber, e.velocity);
                            break;
                        case "noteOff":
                            this.processor.noteOff(e.channel, e.noteNumber);
                            break;
                        case "pitchBend":
                            this.processor.pitchBend(e.channel, e.value);
                            break;
                        case "programChange":
                            this.processor.programChange(e.channel, e.value);
                            break;
                        case "controller": {
                            switch (e.controllerType) {
                                case MIDIControlEvents.NONREG_PARM_NUM_MSB:
                                case MIDIControlEvents.NONREG_PARM_NUM_LSB: // NRPN LSB
                                    // Delete the rpn for do not send NRPN data events
                                    delete this.rpnEvents[e.channel];
                                    break;
                                case MIDIControlEvents.REGIST_PARM_NUM_MSB: {
                                    if (e.value === 127) {
                                        delete this.rpnEvents[e.channel];
                                    }
                                    else {
                                        this.rpnEvents[e.channel] = {
                                            ...this.rpnEvents[e.channel],
                                            rpnMSB: e,
                                        };
                                    }
                                    break;
                                }
                                case MIDIControlEvents.REGIST_PARM_NUM_LSB: {
                                    if (e.value === 127) {
                                        delete this.rpnEvents[e.channel];
                                    }
                                    else {
                                        this.rpnEvents[e.channel] = {
                                            ...this.rpnEvents[e.channel],
                                            rpnLSB: e,
                                        };
                                    }
                                    break;
                                }
                                case MIDIControlEvents.MSB_DATA_ENTRY: {
                                    const rpn = {
                                        ...this.rpnEvents[e.channel],
                                        dataMSB: e,
                                    };
                                    this.rpnEvents[e.channel] = rpn;
                                    // In case of pitch bend sensitivity,
                                    // send without waiting for Data LSB event
                                    if (rpn.rpnLSB?.value === 0) {
                                        this.processor.setPitchBendSensitivity(e.channel, rpn.dataMSB.value);
                                    }
                                    break;
                                }
                                case MIDIControlEvents.LSB_DATA_ENTRY: {
                                    this.rpnEvents[e.channel] = {
                                        ...this.rpnEvents[e.channel],
                                        dataLSB: e,
                                    };
                                    // TODO: Send other RPN events
                                    break;
                                }
                                case MIDIControlEvents.MSB_MAIN_VOLUME:
                                    this.processor.setMainVolume(e.channel, e.value);
                                    break;
                                case MIDIControlEvents.MSB_EXPRESSION:
                                    this.processor.expression(e.channel, e.value);
                                    break;
                                case MIDIControlEvents.ALL_SOUNDS_OFF:
                                    this.processor.allSoundsOff(e.channel);
                                    break;
                                case MIDIControlEvents.ALL_NOTES_OFF:
                                    this.processor.allNotesOff(e.channel);
                                    break;
                                case MIDIControlEvents.SUSTAIN:
                                    this.processor.hold(e.channel, e.value);
                                    break;
                                case MIDIControlEvents.MSB_PAN:
                                    this.processor.setPan(e.channel, e.value);
                                    break;
                                case MIDIControlEvents.MSB_MODWHEEL:
                                    this.processor.modulation(e.channel, e.value);
                                    break;
                                case MIDIControlEvents.MSB_BANK:
                                    this.bankSelectMSB[e.channel] = e.value;
                                    break;
                                case MIDIControlEvents.LSB_BANK: {
                                    const msb = this.bankSelectMSB[e.channel];
                                    if (msb !== undefined) {
                                        const bank = (msb << 7) + e.value;
                                        this.processor.bankSelect(e.channel, bank);
                                    }
                                    break;
                                }
                                case MIDIControlEvents.RESET_CONTROLLERS:
                                    this.processor.resetChannel(e.channel);
                                    break;
                            }
                            break;
                        }
                    }
                    break;
                }
            }
        }
    }

    // https://gist.github.com/fmal/763d9c953c5a5f8b8f9099dbc58da55e
    function insertSorted(arr, item, prop) {
        let low = 0;
        let high = arr.length;
        let mid;
        while (low < high) {
            mid = (low + high) >>> 1; // like (num / 2) but faster
            if (arr[mid][prop] < item[prop]) {
                low = mid + 1;
            }
            else {
                high = mid;
            }
        }
        arr.splice(low, 0, item);
    }

    class SynthEventScheduler {
        getCurrentFrame;
        onImmediateEvent;
        onDelayableEvent;
        scheduledEvents = [];
        scheduledReverbEvents = [];
        currentEvents = [];
        currentReverbEvents = [];
        constructor(getCurrentFrame, onImmediateEvent, onDelayableEvent) {
            this.getCurrentFrame = getCurrentFrame;
            this.onImmediateEvent = onImmediateEvent;
            this.onDelayableEvent = onDelayableEvent;
        }
        get currentFrame() {
            return this.getCurrentFrame();
        }
        addEvent(e) {
            logger.log(e);
            if (e.type === "reverbControl") {
                // Handle reverb control events with timing
                if (e.delayTime > 0) {
                    insertSorted(this.scheduledReverbEvents, {
                        ...e,
                        scheduledFrame: this.currentFrame + e.delayTime,
                    }, "scheduledFrame");
                }
                else {
                    this.onImmediateEvent(e);
                }
            }
            else if ("delayTime" in e) {
                // handle MIDI events in process
                insertSorted(this.scheduledEvents, {
                    ...e,
                    scheduledFrame: this.currentFrame + e.delayTime,
                }, "scheduledFrame");
            }
            else {
                this.onImmediateEvent(e);
            }
        }
        processScheduledEvents() {
            // Process scheduled reverb events
            while (this.scheduledReverbEvents.length > 0) {
                const e = this.scheduledReverbEvents[0];
                if (e === undefined || e.scheduledFrame > this.currentFrame) {
                    break;
                }
                this.scheduledReverbEvents.shift();
                this.onImmediateEvent(e);
            }
            // Process scheduled MIDI events
            if (this.scheduledEvents.length === 0) {
                return;
            }
            while (true) {
                const e = this.scheduledEvents[0];
                if (e === undefined || e.scheduledFrame > this.currentFrame) {
                    // scheduledEvents are sorted by scheduledFrame,
                    // so we can break early instead of iterating through all scheduledEvents,
                    break;
                }
                this.scheduledEvents.shift();
                this.currentEvents.push(e);
            }
            this.currentEvents.sort(sortEvents);
            while (true) {
                const e = this.currentEvents.shift();
                if (e === undefined) {
                    break;
                }
                this.onDelayableEvent(e.midi);
            }
        }
        removeScheduledEvents(channel) {
            this.scheduledEvents = this.scheduledEvents.filter((e) => e.midi.channel !== channel);
            this.currentEvents = this.currentEvents.filter((e) => e.midi.channel !== channel);
            // Note: reverb events don't have channels, so we don't filter them
        }
    }
    function sortEvents(a, b) {
        // First, compare by scheduledFrame.
        if (a.scheduledFrame < b.scheduledFrame) {
            return -1;
        }
        else if (a.scheduledFrame > b.scheduledFrame) {
            return 1;
        }
        // If scheduledFrame is the same, compare by sequenceNumber.
        if (a.sequenceNumber < b.sequenceNumber) {
            return -1;
        }
        else if (a.sequenceNumber > b.sequenceNumber) {
            return 1;
        }
        // If both fields are the same.
        return 0;
    }

    var EnvelopePhase;
    (function (EnvelopePhase) {
        EnvelopePhase[EnvelopePhase["attack"] = 0] = "attack";
        EnvelopePhase[EnvelopePhase["hold"] = 1] = "hold";
        EnvelopePhase[EnvelopePhase["decay"] = 2] = "decay";
        EnvelopePhase[EnvelopePhase["sustain"] = 3] = "sustain";
        EnvelopePhase[EnvelopePhase["release"] = 4] = "release";
        EnvelopePhase[EnvelopePhase["forceStop"] = 5] = "forceStop";
        EnvelopePhase[EnvelopePhase["stopped"] = 6] = "stopped";
    })(EnvelopePhase || (EnvelopePhase = {}));
    const forceStopReleaseTime = 0.1;
    class AmplitudeEnvelope {
        parameter;
        _phase = EnvelopePhase.stopped;
        isNoteOff = false;
        phaseTime = 0;
        decayLevel = 0; // amplitude level at the end of decay phase
        lastAmplitude = 0;
        sampleRate;
        constructor(parameter, sampleRate) {
            this.parameter = parameter;
            this.sampleRate = sampleRate;
        }
        get phase() {
            return this._phase;
        }
        set phase(phase) {
            if (this._phase === phase) {
                return;
            }
            this._phase = phase;
            this.phaseTime = 0;
        }
        noteOn() {
            this.phase = EnvelopePhase.attack;
            this.isNoteOff = false;
            this.phaseTime = 0;
            this.decayLevel = this.parameter.sustainLevel;
        }
        noteOff() {
            this.isNoteOff = true;
        }
        // Rapidly decrease the volume. This method ignores release time parameter
        forceStop() {
            this.phase = EnvelopePhase.forceStop;
        }
        calculateAmplitude(bufferSize) {
            const { attackTime, holdTime, decayTime, sustainLevel, releaseTime } = this.parameter;
            const { sampleRate } = this;
            if (this.isNoteOff &&
                (this.phase === EnvelopePhase.decay ||
                    this.phase === EnvelopePhase.sustain)) {
                this.phase = EnvelopePhase.release;
                this.decayLevel = this.lastAmplitude;
            }
            // Attack
            switch (this.phase) {
                case EnvelopePhase.attack: {
                    const amplificationPerFrame = (1 / (attackTime * sampleRate)) * bufferSize;
                    const value = this.lastAmplitude + amplificationPerFrame;
                    if (value >= 1) {
                        this.phase = EnvelopePhase.hold;
                        return 1;
                    }
                    return value;
                }
                case EnvelopePhase.hold: {
                    if (this.phaseTime >= holdTime) {
                        this.phase = EnvelopePhase.decay;
                    }
                    return this.lastAmplitude;
                }
                case EnvelopePhase.decay: {
                    const attenuationDecibel = linearToDecibel(sustainLevel / 1);
                    const value = logAttenuation(1.0, attenuationDecibel, decayTime, this.phaseTime);
                    if (this.phaseTime > decayTime) {
                        if (sustainLevel <= 0) {
                            this.phase = EnvelopePhase.stopped;
                            return 0;
                        }
                        else {
                            this.phase = EnvelopePhase.sustain;
                            return sustainLevel;
                        }
                    }
                    return value;
                }
                case EnvelopePhase.sustain: {
                    return sustainLevel;
                }
                case EnvelopePhase.release: {
                    const value = logAttenuation(this.decayLevel, -100, // -100dB means almost silence
                    releaseTime, this.phaseTime);
                    if (this.phaseTime > releaseTime || value <= 0) {
                        this.phase = EnvelopePhase.stopped;
                        return 0;
                    }
                    return value;
                }
                case EnvelopePhase.forceStop: {
                    const attenuationPerFrame = (1 / (forceStopReleaseTime * sampleRate)) * bufferSize;
                    const value = this.lastAmplitude - attenuationPerFrame;
                    if (value <= 0) {
                        this.phase = EnvelopePhase.stopped;
                        return 0;
                    }
                    return value;
                }
                case EnvelopePhase.stopped: {
                    return 0;
                }
            }
        }
        getAmplitude(bufferSize) {
            const value = this.calculateAmplitude(bufferSize);
            this.lastAmplitude = value;
            this.phaseTime += bufferSize / sampleRate;
            return value;
        }
        get isPlaying() {
            return this.phase !== EnvelopePhase.stopped;
        }
    }
    // An exponential decay function. It attenuates the value of decibel over the duration time.
    function logAttenuation(fromLevel, attenuationDecibel, duration, time) {
        return fromLevel * decibelToLinear((attenuationDecibel / duration) * time);
    }
    function linearToDecibel(value) {
        return 20 * Math.log10(value);
    }
    function decibelToLinear(value) {
        return Math.pow(10, value / 20);
    }

    class LFO {
        // Hz
        frequency = 5;
        phase = 0;
        sampleRate;
        constructor(sampleRate) {
            this.sampleRate = sampleRate;
        }
        getValue(bufferSize) {
            const phase = this.phase;
            this.phase +=
                ((Math.PI * 2 * this.frequency) / this.sampleRate) * bufferSize;
            return Math.sin(phase);
        }
    }

    class WavetableOscillator {
        sample;
        sampleIndex = 0;
        _isPlaying = false;
        _isNoteOff = false;
        baseSpeed = 1;
        envelope;
        pitchLFO;
        sampleRate;
        speed = 1;
        // 0 to 1
        velocity = 1;
        // 0 to 1
        volume = 1;
        modulation = 0;
        // cent
        modulationDepthRange = 50;
        // -1 to 1
        pan = 0;
        // This oscillator should be note off when hold pedal off
        isHold = false;
        constructor(sample, sampleRate) {
            this.sample = sample;
            this.sampleRate = sampleRate;
            this.envelope = new AmplitudeEnvelope(sample.amplitudeEnvelope, sampleRate);
            this.pitchLFO = new LFO(sampleRate);
        }
        noteOn(pitch, velocity) {
            this.velocity = velocity;
            this._isPlaying = true;
            this.sampleIndex = this.sample.sampleStart;
            this.baseSpeed = Math.pow(2, ((pitch - this.sample.pitch) / 12) * this.sample.scaleTuning);
            this.pitchLFO.frequency = 5;
            this.envelope.noteOn();
        }
        noteOff() {
            this.envelope.noteOff();
            this._isNoteOff = true;
        }
        forceStop() {
            this.envelope.forceStop();
        }
        process(outputs) {
            if (!this._isPlaying) {
                return;
            }
            const speed = (this.baseSpeed * this.speed * this.sample.sampleRate) / this.sampleRate;
            const volume = (this.velocity * this.volume) ** 2 * this.sample.volume;
            // zero to pi/2
            const panTheta = ((Math.min(1, Math.max(-1, this.pan + this.sample.pan)) + 1) * Math.PI) /
                4;
            const leftPanVolume = Math.cos(panTheta);
            const rightPanVolume = Math.sin(panTheta);
            const gain = this.envelope.getAmplitude(outputs[0].length);
            const leftGain = gain * volume * leftPanVolume;
            const rightGain = gain * volume * rightPanVolume;
            const pitchLFOValue = this.pitchLFO.getValue(outputs[0].length);
            const pitchModulation = pitchLFOValue * this.modulation * (this.modulationDepthRange / 1200);
            const modulatedSpeed = speed * (1 + pitchModulation);
            for (let i = 0; i < outputs[0].length; ++i) {
                const index = Math.floor(this.sampleIndex);
                const advancedIndex = this.sampleIndex + modulatedSpeed;
                let loopIndex = null;
                if ((this.sample.loop.type === "loop_continuous" ||
                    (this.sample.loop.type === "loop_sustain" && !this._isNoteOff)) &&
                    advancedIndex >= this.sample.loop.end) {
                    loopIndex =
                        this.sample.loop.start + (advancedIndex - Math.floor(advancedIndex));
                }
                const nextIndex = loopIndex !== null
                    ? Math.floor(loopIndex)
                    : Math.min(index + 1, this.sample.sampleEnd - 1);
                // linear interpolation
                const current = this.sample.buffer[index];
                const next = this.sample.buffer[nextIndex];
                const level = current + (next - current) * (this.sampleIndex - index);
                outputs[0][i] += level * leftGain;
                outputs[1][i] += level * rightGain;
                this.sampleIndex = loopIndex ?? advancedIndex;
                if (this.sampleIndex >= this.sample.sampleEnd) {
                    this._isPlaying = false;
                    break;
                }
            }
        }
        get isPlaying() {
            return this._isPlaying && this.envelope.isPlaying;
        }
        get isNoteOff() {
            return this._isNoteOff;
        }
        get exclusiveClass() {
            return this.sample.exclusiveClass;
        }
    }

    const initialChannelState = () => ({
        volume: 1,
        bank: 0,
        instrument: 0,
        pitchBend: 0,
        pitchBendSensitivity: 2,
        oscillators: {},
        expression: 1,
        pan: 0,
        modulation: 0,
        hold: false,
    });
    const RHYTHM_CHANNEL = 9;
    const RHYTHM_BANK = 128;
    class SynthProcessorCore {
        sampleRate;
        getCurrentFrame;
        sampleTable = new SampleTable();
        channels = {};
        eventScheduler;
        reverbProcessor;
        constructor(sampleRate, getCurrentFrame) {
            this.sampleRate = sampleRate;
            this.getCurrentFrame = getCurrentFrame;
            const eventHandler = new SynthEventHandler(this);
            this.eventScheduler = new SynthEventScheduler(getCurrentFrame, (e) => eventHandler.handleImmediateEvent(e), (e) => eventHandler.handleDelayableEvent(e));
            this.sampleRate = sampleRate;
            this.getCurrentFrame = getCurrentFrame;
            this.reverbProcessor = new ReverbProcessor(sampleRate);
        }
        get currentFrame() {
            return this.getCurrentFrame();
        }
        getSamples(channel, pitch, velocity) {
            const state = this.getChannelState(channel);
            // Play drums for CH.10
            const bank = channel === RHYTHM_CHANNEL ? RHYTHM_BANK : state.bank;
            return this.sampleTable.getSamples(bank, state.instrument, pitch, velocity);
        }
        addSample(data, sampleID) {
            this.sampleTable.addSample(new Float32Array(data), sampleID);
        }
        addSampleParameter(parameter, range) {
            this.sampleTable.addSampleParameter(parameter, range);
        }
        addEvent(e) {
            this.eventScheduler.addEvent(e);
        }
        noteOn(channel, pitch, velocity) {
            const state = this.getChannelState(channel);
            const samples = this.getSamples(channel, pitch, velocity);
            if (samples.length === 0) {
                logger.warn(`There is no sample for noteNumber ${pitch} in instrument ${state.instrument} in bank ${state.bank}`);
                return;
            }
            for (const sample of samples) {
                const oscillator = new WavetableOscillator(sample, this.sampleRate);
                const volume = velocity / 127;
                oscillator.noteOn(pitch, volume);
                if (state.oscillators[pitch] === undefined) {
                    state.oscillators[pitch] = [];
                }
                if (sample.exclusiveClass !== undefined) {
                    for (const key in state.oscillators) {
                        for (const osc of state.oscillators[key]) {
                            if (osc.exclusiveClass === sample.exclusiveClass) {
                                osc.forceStop();
                            }
                        }
                    }
                }
                state.oscillators[pitch].push(oscillator);
            }
        }
        noteOff(channel, pitch) {
            const state = this.getChannelState(channel);
            if (state.oscillators[pitch] === undefined) {
                return;
            }
            for (const osc of state.oscillators[pitch]) {
                if (!osc.isNoteOff) {
                    if (state.hold) {
                        osc.isHold = true;
                    }
                    else {
                        osc.noteOff();
                    }
                }
            }
        }
        pitchBend(channel, value) {
            const state = this.getChannelState(channel);
            state.pitchBend = (value / 0x2000 - 1) * state.pitchBendSensitivity;
        }
        programChange(channel, value) {
            const state = this.getChannelState(channel);
            state.instrument = value;
        }
        setPitchBendSensitivity(channel, value) {
            const state = this.getChannelState(channel);
            state.pitchBendSensitivity = value;
        }
        setMainVolume(channel, value) {
            const state = this.getChannelState(channel);
            state.volume = value / 127;
        }
        expression(channel, value) {
            const state = this.getChannelState(channel);
            state.expression = value / 127;
        }
        allSoundsOff(channel) {
            this.eventScheduler.removeScheduledEvents(channel);
            const state = this.getChannelState(channel);
            for (const key in state.oscillators) {
                for (const osc of state.oscillators[key]) {
                    osc.forceStop();
                }
            }
        }
        allNotesOff(channel) {
            const state = this.getChannelState(channel);
            for (const key in state.oscillators) {
                for (const osc of state.oscillators[key]) {
                    osc.noteOff();
                }
            }
        }
        hold(channel, value) {
            const hold = value >= 64;
            const state = this.getChannelState(channel);
            state.hold = hold;
            if (hold) {
                return;
            }
            for (const key in state.oscillators) {
                for (const osc of state.oscillators[key]) {
                    if (osc.isHold) {
                        osc.noteOff();
                    }
                }
            }
        }
        setPan(channel, value) {
            const state = this.getChannelState(channel);
            state.pan = (value / 127 - 0.5) * 2;
        }
        bankSelect(channel, value) {
            const state = this.getChannelState(channel);
            state.bank = value;
        }
        modulation(channel, value) {
            const state = this.getChannelState(channel);
            state.modulation = value / 127;
        }
        resetChannel(channel) {
            delete this.channels[channel];
        }
        getChannelState(channel) {
            const state = this.channels[channel];
            if (state !== undefined) {
                return state;
            }
            const newState = initialChannelState();
            this.channels[channel] = newState;
            return newState;
        }
        setReverb(amount) {
            this.reverbProcessor.setReverb(amount);
        }
        process(outputs) {
            this.eventScheduler.processScheduledEvents();
            // Create temporary buffers for dry signal
            const dryLeft = new Float32Array(outputs[0].length);
            const dryRight = new Float32Array(outputs[1].length);
            for (const channel in this.channels) {
                const state = this.channels[channel];
                for (let key in state.oscillators) {
                    state.oscillators[key] = state.oscillators[key].filter((oscillator) => {
                        oscillator.speed = Math.pow(2, state.pitchBend / 12);
                        oscillator.volume = state.volume * state.expression;
                        oscillator.pan = state.pan;
                        oscillator.modulation = state.modulation;
                        oscillator.process([dryLeft, dryRight]);
                        if (!oscillator.isPlaying) {
                            return false;
                        }
                        return true;
                    });
                }
            }
            // Apply reverb to the dry signal and output to final outputs
            this.reverbProcessor.process(dryLeft, dryRight, outputs[0], outputs[1]);
        }
    }

    // returns in frame unit
    const getSongLength = (events) => max(events.map((e) => (e.type === "midi" ? e.delayTime : 0))) ?? 0;
    // Maximum time to wait for the note release sound to become silent
    const silentTimeoutSec = 5;
    const isArrayZero = (arr) => {
        for (let i = 0; i < arr.length; i++) {
            if (arr[i] !== 0) {
                return false;
            }
        }
        return true;
    };
    const renderAudio = async (samples, events, options) => {
        let currentFrame = 0;
        const sampleRate = options?.sampleRate ?? 44100;
        const bufSize = options?.bufferSize ?? 500;
        const synth = new SynthProcessorCore(sampleRate, () => currentFrame);
        let sequenceNumber = 0;
        samples.forEach((e) => synth.addEvent({ ...e, sequenceNumber: sequenceNumber++ }));
        events.forEach((e) => synth.addEvent({ ...e, sequenceNumber: sequenceNumber++ }));
        const songLengthFrame = getSongLength(events);
        const iterCount = Math.ceil(songLengthFrame / bufSize);
        const additionalIterCount = Math.ceil((silentTimeoutSec * sampleRate) / bufSize);
        const allIterCount = iterCount + additionalIterCount;
        const audioBufferSize = allIterCount * bufSize;
        const leftData = new Float32Array(audioBufferSize);
        const rightData = new Float32Array(audioBufferSize);
        const buffer = [new Float32Array(bufSize), new Float32Array(bufSize)];
        for (let i = 0; i < allIterCount; i++) {
            buffer[0].fill(0);
            buffer[1].fill(0);
            synth.process(buffer);
            const offset = i * bufSize;
            leftData.set(buffer[0], offset);
            rightData.set(buffer[1], offset);
            currentFrame += bufSize;
            // Wait for silence after playback is complete.
            if (i > iterCount && isArrayZero(buffer[0]) && isArrayZero(buffer[1])) {
                console.log(`early break ${i} in ${iterCount + additionalIterCount}`);
                break;
            }
            // give a chance to terminate the loop or update progress
            if (i % 1000 === 0) {
                await options?.waitForEventLoop?.();
                options?.onProgress?.(offset, audioBufferSize);
                if (options?.cancel?.()) {
                    throw new Error("renderAudio cancelled");
                }
            }
        }
        // slice() to delete silent parts
        const trimmedLeft = leftData.slice(0, currentFrame);
        const trimmedRight = rightData.slice(0, currentFrame);
        return {
            length: trimmedLeft.length,
            leftData: trimmedLeft.buffer,
            rightData: trimmedRight.buffer,
            sampleRate,
        };
    };

    let cancelled = false;
    const fastSleep = new FastSleep();
    onmessage = async (e) => {
        switch (e.data.type) {
            case "cancel": {
                cancelled = true;
                break;
            }
            case "start": {
                const { samples, events, sampleRate, bufferSize } = e.data;
                try {
                    const audioData = await renderAudio(samples, events, {
                        sampleRate,
                        bufferSize,
                        cancel: () => cancelled,
                        waitForEventLoop: async () => await fastSleep.wait(),
                        onProgress: (numBytes, totalBytes) => postMessage({
                            type: "progress",
                            numBytes,
                            totalBytes,
                        }),
                    });
                    postMessage({ type: "complete", audioData }, [
                        audioData.leftData,
                        audioData.rightData,
                    ]);
                }
                catch (e) {
                    console.error(e.message);
                }
                close();
                break;
            }
        }
    };

})();
//# sourceMappingURL=rendererWorker.js.map
