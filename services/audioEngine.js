/**
 * Audio Engine using Native Web Audio API
 */
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.chordIntervalId = null;
        this.isPlayingChords = false;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    // Helper to map MIDI to raw frequency
    midiToFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    playTone(midi, startTime, duration, type = "piano", volume = 0.3) {
        this.init();

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
            masterGain.connect(this.ctx.destination);

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
        gainNode.connect(this.ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
    }

    playMelody(melody) {
        this.init();
        let startNow = this.ctx.currentTime;
        
        const mergedMelody = [];
        melody.forEach(note => {
            if (note === 'BAR' || note.type === 'BAR') return;
            if (note.tied && mergedMelody.length > 0 && mergedMelody[mergedMelody.length - 1].pitch === note.pitch) {
                mergedMelody[mergedMelody.length - 1].duration += note.duration;
            } else {
                mergedMelody.push({ ...note });
            }
        });

        mergedMelody.forEach(note => {
            const startTime = startNow + (note.beat * 0.5);
            const seconds = note.duration * 0.5;
            this.playTone(note.pitch, startTime, seconds, "piano", 0.5);
        });
    }

    playBoth(melody, chords) {
        this.init();
        let startNow = this.ctx.currentTime;

        const mergedMelody = [];
        melody.forEach(note => {
            if (note === 'BAR' || note.type === 'BAR') return;
            if (note.tied && mergedMelody.length > 0 && mergedMelody[mergedMelody.length - 1].pitch === note.pitch) {
                mergedMelody[mergedMelody.length - 1].duration += note.duration;
            } else {
                mergedMelody.push({ ...note });
            }
        });

        mergedMelody.forEach(note => {
            const startTime = startNow + (note.beat * 0.5);
            const seconds = note.duration * 0.5;
            this.playTone(note.pitch, startTime, seconds, "piano", 0.5);
        });

        chords.forEach(chord => {
            const startTime = startNow + (chord.beat * 0.5);
            const seconds = chord.duration * 0.5;
            const pitches = this.getChordPitches(chord.root, chord.type);

            this.playTone(chord.root - 12, startTime, seconds, "piano", 0.25); // Bass Root
            pitches.forEach(pitch => {
                this.playTone(pitch, startTime, seconds, "piano", 0.15); // Chord Voicings
            });
        });
    }

    // Simple root + basic triad/seventhvoicing strategy generator
    getChordPitches(root, type) {
        const voicings = {
            "maj7": [0, 4, 7, 11],
            "7": [0, 4, 7, 10],
            "m7": [0, 3, 7, 10],
            "m6": [0, 3, 7, 9],
            "7b9": [0, 4, 10, 13]
        };
        const intervals = voicings[type] || [0, 4, 7];
        return intervals.map(interval => root + interval);
    }

    startChordsLoop(chords) {
        this.init();
        if (this.isPlayingChords) this.stopChordsLoop();
        this.isPlayingChords = true;

        const playIteration = () => {
            let startNow = this.ctx.currentTime;
            chords.forEach(chord => {
                const startTime = startNow + (chord.beat * 0.5);
                const seconds = chord.duration * 0.5;
                const pitches = this.getChordPitches(chord.root, chord.type);

                this.playTone(chord.root - 12, startTime, seconds, "piano", 0.25); // Bass Root
                pitches.forEach(pitch => {
                    this.playTone(pitch, startTime, seconds, "piano", 0.15); // Chord Voicings
                });
            });
        };

        // Calculate full length of chart to loop cleanly
        const lastChord = chords[chords.length - 1];
        const totalDurationMs = lastChord ? (lastChord.beat + lastChord.duration) * 500 : 0;

        if (totalDurationMs > 0) {
            playIteration();
            this.chordIntervalId = setInterval(playIteration, totalDurationMs);
        }
    }

    stopChordsLoop() {
        if (this.chordIntervalId) {
            clearInterval(this.chordIntervalId);
            this.chordIntervalId = null;
        }
        this.isPlayingChords = false;
    }
}

export const audioEngine = new AudioEngine();