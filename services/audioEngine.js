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

    playTone(midi, startTime, duration, type = "sine", volume = 0.3) {
        this.init();
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
        let now = this.ctx.currentTime;
        melody.forEach(note => {
            if (note === 'BAR' || note.type === 'BAR') return;
            // Adjust time duration (assuming 1 unit = 0.5 seconds at ~120 BPM)
            const seconds = note.duration * 0.5;
            this.playTone(note.pitch, now, seconds, "triangle", 0.4);
            now += seconds;
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
            let now = this.ctx.currentTime;
            chords.forEach(chord => {
                const seconds = chord.duration * 0.5;
                const pitches = this.getChordPitches(chord.root, chord.type);

                pitches.forEach(pitch => {
                    // Soft warmth via sawtooth filters or low sine/triangle blends
                    this.playTone(pitch - 12, now, seconds, "sine", 0.15); // Add lower octave root
                    this.playTone(pitch, now, seconds, "sine", 0.12);
                });
                now += seconds;
            });
        };

        // Calculate full length of chart to loop cleanly
        const totalDurationMs = chords.reduce((sum, c) => sum + (c.duration * 500), 0);
        playIteration();
        this.chordIntervalId = setInterval(playIteration, totalDurationMs);
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