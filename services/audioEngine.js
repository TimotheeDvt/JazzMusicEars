/**
 * Audio Engine using Native Web Audio API
 */
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.chordIntervalId = null;
        this.isPlayingChords = false;
        this.tempo = 120;
        this.clickEnabled = false;
        this.activeNodes = new Set();
        this.melodyVolume = 1.0;
        this.chordVolume = 1.0;
        this.clickVolume = 1.0;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();

            // Create dedicated buses for mixing Melody and Chords independently
            this.melodyGain = this.ctx.createGain();
            this.chordGain = this.ctx.createGain();
            this.clickGain = this.ctx.createGain();

            this.melodyGain.connect(this.ctx.destination);
            this.chordGain.connect(this.ctx.destination);
            this.clickGain.connect(this.ctx.destination);

            this.melodyGain.gain.value = Math.pow(this.melodyVolume, 2);
            this.chordGain.gain.value = Math.pow(this.chordVolume, 2);
            this.clickGain.gain.value = this.clickEnabled ? Math.pow(this.clickVolume, 2) : 0;
        }
    }

    setMelodyVolume(val) {
        this.melodyVolume = val;
        if (this.melodyGain && this.ctx) {
            this.melodyGain.gain.setTargetAtTime(Math.pow(val, 2), this.ctx.currentTime, 0.05); // Exponential Audio Taper
        }
    }

    setChordVolume(val) {
        this.chordVolume = val;
        if (this.chordGain && this.ctx) {
            this.chordGain.gain.setTargetAtTime(Math.pow(val, 2), this.ctx.currentTime, 0.05); // Exponential Audio Taper
        }
    }

    setClickVolume(val) {
        this.clickVolume = val;
        if (this.clickGain && this.ctx && this.clickEnabled) {
            this.clickGain.gain.setTargetAtTime(Math.pow(val, 2), this.ctx.currentTime, 0.05);
        }
    }

    setClickEnabled(enabled) {
        this.clickEnabled = enabled;
        if (this.clickGain && this.ctx) {
            this.clickGain.gain.setTargetAtTime(enabled ? Math.pow(this.clickVolume, 2) : 0, this.ctx.currentTime, 0.01);
        }
    }

    // Helper to map MIDI to raw frequency
    midiToFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    get secPerBeat() {
        return 60 / this.tempo;
    }

    playClick(startTime) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1000, startTime);
        osc.frequency.exponentialRampToValueAtTime(100, startTime + 0.05);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.5, startTime + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.05);

        osc.connect(gain);
        gain.connect(this.clickGain);

        osc.onended = () => this.activeNodes.delete(osc);
        this.activeNodes.add(osc);

        osc.start(startTime);
        osc.stop(startTime + 0.05);
    }

    playTone(midi, startTime, duration, type = "piano", volume = 0.3, outputNode = null) {
        this.init();
        const dest = outputNode || this.ctx.destination;

        if (type === "piano") {
            const freq = this.midiToFreq(midi);

            // Combine 3 oscillators for a rich, string-like harmonic body
            const osc1 = this.ctx.createOscillator(); osc1.type = 'triangle';
            const osc2 = this.ctx.createOscillator(); osc2.type = 'sine';
            const osc3 = this.ctx.createOscillator(); osc3.type = 'sawtooth';

            osc1.frequency.value = freq;
            osc2.frequency.value = freq;
            osc3.frequency.value = freq * 1.001; // Tiny detune for realism/chorus

            const mixGain1 = this.ctx.createGain(); mixGain1.gain.value = 1.0;
            const mixGain2 = this.ctx.createGain(); mixGain2.gain.value = 0.5;
            const mixGain3 = this.ctx.createGain(); mixGain3.gain.value = 0.15;

            osc1.connect(mixGain1); osc2.connect(mixGain2); osc3.connect(mixGain3);

            // Low-pass filter to dampen the harshness and simulate a struck string
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';

            // Strictly sequenced time envelopes to prevent API overlap errors
            const attackTime = startTime + Math.min(0.015, duration * 0.1);
            const sustainTime = attackTime + Math.min(0.3, duration * 0.5);

            filter.frequency.setValueAtTime(freq * 5, startTime);
            filter.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.5, 100), sustainTime);

            mixGain1.connect(filter); mixGain2.connect(filter); mixGain3.connect(filter);

            // Piano ADSR Gain Envelope
            const masterGain = this.ctx.createGain();
            masterGain.gain.setValueAtTime(0, startTime);
            masterGain.gain.linearRampToValueAtTime(volume, attackTime); // Fast hammer strike
            masterGain.gain.exponentialRampToValueAtTime(Math.max(volume * 0.2, 0.001), sustainTime); // Ring decay
            masterGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration); // Release

            filter.connect(masterGain);
            masterGain.connect(dest);

            osc1.onended = () => this.activeNodes.delete(osc1);
            osc2.onended = () => this.activeNodes.delete(osc2);
            osc3.onended = () => this.activeNodes.delete(osc3);
            this.activeNodes.add(osc1);
            this.activeNodes.add(osc2);
            this.activeNodes.add(osc3);

            osc1.start(startTime); osc2.start(startTime); osc3.start(startTime);
            osc1.stop(startTime + duration); osc2.stop(startTime + duration); osc3.stop(startTime + duration);
            return;
        }

        // Fallback for simple wave synthesis
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(this.midiToFreq(midi), startTime);

        // Expressive volume envelope (prevents clicking)
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.05);
        gainNode.gain.setValueAtTime(volume, startTime + duration - 0.05);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

        osc.connect(gainNode);
        gainNode.connect(dest);

        osc.onended = () => this.activeNodes.delete(osc);
        this.activeNodes.add(osc);

        osc.start(startTime);
        osc.stop(startTime + duration);
    }

    playMelody(melody, startBeat = 0) {
        this.init();
        let startNow = this.ctx.currentTime;
        let maxBeat = startBeat;

        const mergedMelody = [];
        melody.forEach(note => {
            if (note.pitch === undefined || note.isRest) return;
            if (note.tied && mergedMelody.length > 0 && mergedMelody[mergedMelody.length - 1].pitch === note.pitch) {
                mergedMelody[mergedMelody.length - 1].duration += note.duration;
            } else {
                mergedMelody.push({ ...note });
            }
        });

        mergedMelody.forEach(note => {
            if (note.beat + note.duration <= startBeat) return;
            let offsetBeat = note.beat - startBeat;
            let duration = note.duration;
            if (offsetBeat < 0) {
                duration += offsetBeat;
                offsetBeat = 0;
            }
            const startTime = startNow + (offsetBeat * this.secPerBeat);
            const seconds = duration * this.secPerBeat;
            this.playTone(note.pitch, startTime, seconds, "piano", 0.5, this.melodyGain);
            maxBeat = Math.max(maxBeat, note.beat + note.duration);
        });

        for (let b = Math.ceil(startBeat); b < Math.ceil(maxBeat); b++) {
            this.playClick(startNow + ((b - startBeat) * this.secPerBeat));
        }

        return (maxBeat - startBeat) * this.secPerBeat;
    }

    playBoth(melody, chords, startBeat = 0) {
        this.init();
        let startNow = this.ctx.currentTime;
        let maxBeat = startBeat;

        const mergedMelody = [];
        melody.forEach(note => {
            if (note.pitch === undefined || note.isRest) return;
            if (note.tied && mergedMelody.length > 0 && mergedMelody[mergedMelody.length - 1].pitch === note.pitch) {
                mergedMelody[mergedMelody.length - 1].duration += note.duration;
            } else {
                mergedMelody.push({ ...note });
            }
        });

        mergedMelody.forEach(note => {
            if (note.beat + note.duration <= startBeat) return;
            let offsetBeat = note.beat - startBeat;
            let duration = note.duration;
            if (offsetBeat < 0) {
                duration += offsetBeat;
                offsetBeat = 0;
            }
            const startTime = startNow + (offsetBeat * this.secPerBeat);
            const seconds = duration * this.secPerBeat;
            this.playTone(note.pitch, startTime, seconds, "piano", 0.5, this.melodyGain);
            maxBeat = Math.max(maxBeat, note.beat + note.duration);
        });

        chords.forEach(chord => {
            if (chord.beat + chord.duration <= startBeat) return;
            let offsetBeat = chord.beat - startBeat;
            let duration = chord.duration;
            if (offsetBeat < 0) {
                duration += offsetBeat;
                offsetBeat = 0;
            }
            const startTime = startNow + (offsetBeat * this.secPerBeat);
            const seconds = duration * this.secPerBeat;
            const pitches = this.getChordPitches(chord.root, chord.type);

            this.playTone(chord.root - 12, startTime, seconds, "piano", 0.25, this.chordGain); // Bass Root
            pitches.forEach(pitch => {
                this.playTone(pitch, startTime, seconds, "piano", 0.15, this.chordGain); // Chord Voicings
            });
            maxBeat = Math.max(maxBeat, chord.beat + chord.duration);
        });

        for (let b = Math.ceil(startBeat); b < Math.ceil(maxBeat); b++) {
            this.playClick(startNow + ((b - startBeat) * this.secPerBeat));
        }

        return (maxBeat - startBeat) * this.secPerBeat;
    }

    // Simple root + basic triad/seventhvoicing strategy generator
    getChordPitches(root, type) {
        const voicings = {
            "m": [0, 3, 7],
            "maj": [0, 4, 7],
            "m7": [0, 3, 7, 10],
            "7": [0, 4, 7, 10],
            "maj7": [0, 4, 7, 11],
            "m7b5": [0, 3, 6, 10],
            "7b9": [0, 4, 10, 13],
            "m6": [0, 3, 7, 9],
            "6": [0, 4, 7, 9],
            "m9": [0, 3, 7, 10],
            "9": [0, 4, 7, 10],
            "m11": [0, 3, 7, 10, 14],
            "11": [0, 4, 7, 10, 14],
            "m13": [0, 3, 7, 10, 14, 17],
            "13": [0, 4, 7, 10, 14, 17]
        };
        const intervals = voicings[type] || [0, 4, 7];
        return intervals.map(interval => root + interval);
    }

    startChordsLoop(chords, startBeat = 0) {
        this.init();
        if (this.isPlayingChords) this.stopChordsLoop();
        this.isPlayingChords = true;

        // Calculate full length of chart to loop cleanly
        const lastChord = chords[chords.length - 1];
        const totalBeats = lastChord ? (lastChord.beat + lastChord.duration) : 0;
        const totalDurationMs = totalBeats * this.secPerBeat * 1000;

        let isFirstIteration = true;

        const playIteration = () => {
            let startNow = this.ctx.currentTime;
            let currentStartBeat = isFirstIteration ? startBeat : 0;
            isFirstIteration = false;

            chords.forEach(chord => {
                if (chord.beat + chord.duration <= currentStartBeat) return;
                let offsetBeat = chord.beat - currentStartBeat;
                let duration = chord.duration;
                if (offsetBeat < 0) { duration += offsetBeat; offsetBeat = 0; }
                const startTime = startNow + (offsetBeat * this.secPerBeat);
                const seconds = duration * this.secPerBeat;
                const pitches = this.getChordPitches(chord.root, chord.type);

                this.playTone(chord.root - 12, startTime, seconds, "piano", 0.25, this.chordGain); // Bass Root
                pitches.forEach(pitch => {
                    this.playTone(pitch, startTime, seconds, "piano", 0.15, this.chordGain); // Chord Voicings
                });
            });

            for (let b = Math.ceil(currentStartBeat); b < Math.ceil(totalBeats); b++) {
                this.playClick(startNow + ((b - currentStartBeat) * this.secPerBeat));
            }
        };

        if (totalDurationMs > 0) {
            playIteration();
            const firstIterationDurationMs = (totalBeats - startBeat) * this.secPerBeat * 1000;
            this.chordIntervalId = setTimeout(() => {
                if (!this.isPlayingChords) return;
                playIteration();
                this.chordIntervalId = setInterval(playIteration, totalDurationMs);
            }, firstIterationDurationMs);
        }
        return totalBeats;
    }

    stopChordsLoop() {
        if (this.chordIntervalId) {
            clearInterval(this.chordIntervalId);
            this.chordIntervalId = null;
        }
        this.isPlayingChords = false;
    }

    stopAll() {
        this.activeNodes.forEach(node => {
            try { node.stop(); } catch (e) { }
        });
        this.activeNodes.clear();
        this.stopChordsLoop();
    }
}

export const audioEngine = new AudioEngine();