const fs = require('fs');
const path = require('path');
const { Midi } = require('@tonejs/midi');

// Helper to quantize to nearest 16th, 8th-triplet, or 16th-triplet
function quantize(value) {
    const sixteenths = Math.round(value * 4) / 4;
    const triplets = Math.round(value * 3) / 3;
    const sixteenthTriplets = Math.round(value * 6) / 6;

    const err16 = Math.abs(value - sixteenths);
    const err8t = Math.abs(value - triplets);
    const err16t = Math.abs(value - sixteenthTriplets);

    let best = sixteenths;
    let minErr = err16;

    if (err8t < minErr - 0.01) {
        best = triplets;
        minErr = err8t;
    }
    if (err16t < minErr - 0.01) {
        best = sixteenthTriplets;
    }
    return best;
}

function formatDuration(value) {
    // First check standard divisions (0.25, 0.5, 0.75, 1, etc.)
    const diff4 = Math.abs(value * 4 - Math.round(value * 4));
    if (diff4 < 0.01) {
        return (Math.round(value * 4) / 4).toString();
    }

    // Then handle tuplets (1/3, 2/3, 1/6, 5/6, etc.)
    const diff6 = Math.abs(value * 6 - Math.round(value * 6));
    if (diff6 < 0.01) {
        const num = Math.round(value * 6);
        // Simplify 2/6 to 1/3, 4/6 to 2/3
        if (num % 2 === 0) {
            return `${num / 2}/3`;
        }
        return `${num}/6`;
    }
    return (Math.round(value * 1000) / 1000).toString();
}

// Helper to convert MIDI number to note name (e.g., 60 -> C4)
function midiToNoteName(midi) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const noteIndex = midi % 12;
    return `${noteNames[noteIndex]}${octave}`;
}

// Helper to detect a chord from a set of MIDI pitches.
// This is a simplified algorithm and works best with root position or simple inversions.
function detectChord(pitches) {
    if (pitches.length < 3) return null; // Must be at least a triad

    const pitchClasses = [...new Set(pitches.map(p => p % 12))].sort((a, b) => a - b);

    // Common jazz chord voicings, from most to least complex
    const voicings = {
        "maj7": [0, 4, 7, 11], "7": [0, 4, 7, 10], "m7": [0, 3, 7, 10],
        "m7b5": [0, 3, 6, 10], "dim7": [0, 3, 6, 9], "m(maj7)": [0, 3, 7, 11],
        "maj": [0, 4, 7], "m": [0, 3, 7], "dim": [0, 3, 6], "aug": [0, 4, 8],
    };

    for (let i = 0; i < pitchClasses.length; i++) {
        const rootPc = pitchClasses[i];
        const normalizedPcs = pitchClasses.map(pc => (pc - rootPc + 12) % 12).sort((a, b) => a - b);

        for (const [type, voicingPcs] of Object.entries(voicings)) {
            if (normalizedPcs.length === voicingPcs.length &&
                normalizedPcs.every((val, index) => val === voicingPcs[index])) {

                // Find the original MIDI note for the root.
                // The lowest note with the root's pitch class is a good candidate.
                const rootNote = pitches.find(p => p % 12 === rootPc);
                return { root: rootNote, type: type };
            }
        }
    }
    return null;
}


function convertMidiToTune(midiFilePath, tuneId) {
    const resolvedMidiPath = path.resolve(midiFilePath);
    if (!fs.existsSync(resolvedMidiPath)) {
        console.error(`Error: File ${resolvedMidiPath} not found.`);
        return;
    }

    console.log(`Parsing MIDI file: ${resolvedMidiPath}`);
    const midiData = fs.readFileSync(resolvedMidiPath);
    const midi = new Midi(midiData);

    // Extract basic header information
    const tempo = midi.header.tempos.length > 0 ? Math.round(midi.header.tempos[0].bpm) : 120;
    let timeSig = [4, 4];
    if (midi.header.timeSignatures.length > 0) {
        const ts = midi.header.timeSignatures[0].timeSignature;
        // Trust time signature only if denominator is 4 (e.g. 3/4, 4/4, 5/4), else default to 4/4
        if (ts[1] === 4) timeSig = ts;
    }
    const ppq = midi.header.ppq;

    // Find the first track that actually contains notes to use as the melody
    const melodyTrack = midi.tracks.find(t => t.notes.length > 0);

    if (!melodyTrack) {
        console.error("Error: No notes found in the MIDI file.");
        return;
    }

    // --- KEY SIGNATURE DETECTION ---
    let detectedKey = "C";
    if (midi.header.keySignatures && midi.header.keySignatures.length > 0) {
        const ks = midi.header.keySignatures[0];
        detectedKey = ks.key + (ks.scale === "minor" && !ks.key.endsWith("m") ? "m" : "");
    } else {
        // Fallback: Guess the tonic from the last note of the melody
        const lastNote = melodyTrack.notes[melodyTrack.notes.length - 1];
        detectedKey = lastNote.name.replace(/\d/g, ''); // Removes octave (e.g., C4 -> C)
    }

    let melodyString = "[1] ";
    let currentBeat = 0;
    let measureBeats = 0;
    const beatsPerBar = timeSig[0]; // Typically 4 for 4/4
    let measureNumberMelody = 1;

    // --- MELODY PARSING ---
    melodyTrack.notes.forEach((note, index) => {
        // Convert MIDI ticks to quarter-note beats
        let startBeat = quantize(note.ticks / ppq);
        let durationBeats = quantize(note.durationTicks / ppq);
        if (durationBeats === 0) durationBeats = 0.5; // Ensure at least 0.5 duration

        // Prevent overlapping backwards if MIDI is messy
        if (startBeat < currentBeat) {
            startBeat = currentBeat;
        }

        // Handle Rests (gaps between notes)
        if (startBeat > currentBeat + 0.01) {
            const restBeats = startBeat - currentBeat;
            melodyString += `${formatDuration(restBeats)} `;
            measureBeats += restBeats;
            while (measureBeats >= beatsPerBar - 0.001) {
                measureNumberMelody++;
                melodyString += `\n        [${measureNumberMelody}] `;
                measureBeats -= beatsPerBar;
            }
        }

        // Format note (e.g. C#4:1.5)
        melodyString += `${note.name}:${formatDuration(durationBeats)} `;
        measureBeats += durationBeats;

        // Formatting: insert a barline and newline roughly every measure for readability
        if (index < melodyTrack.notes.length - 1) {
            while (measureBeats >= beatsPerBar - 0.001) {
                measureNumberMelody++;
                melodyString += `\n        [${measureNumberMelody}] `;
                measureBeats -= beatsPerBar;
            }
        }

        currentBeat = startBeat + durationBeats;
    });

    // --- CHORD PARSING ---
    // This is a simple chord detection and may not work for arpeggiated chords or complex voicings.
    let chordsString = "";
    const chordNotes = midi.tracks
        .filter(track => track !== melodyTrack && track.notes.length > 0)
        .flatMap(track => track.notes);

    if (chordNotes.length > 0) {
        const notesByTick = new Map();
        // Quantize notes to the nearest 32nd note to group them into chords
        const tickResolution = ppq / 8;
        chordNotes.forEach(note => {
            const quantizedTick = Math.round(note.ticks / tickResolution) * tickResolution;
            if (!notesByTick.has(quantizedTick)) {
                notesByTick.set(quantizedTick, []);
            }
            notesByTick.get(quantizedTick).push(note);
        });

        const sortedTicks = Array.from(notesByTick.keys()).sort((a, b) => a - b);
        let lastChordBeat = 0;
        let measureBeatsChords = 0;
        let chordsStringOutput = "[1] ";
        let measureNumberChords = 1;

        for (let i = 0; i < sortedTicks.length; i++) {
            const tick = sortedTicks[i];
            const nextTick = sortedTicks[i + 1];

            const notes = notesByTick.get(tick);
            const pitches = notes.map(n => n.midi).sort((a, b) => a - b);
            const chord = detectChord(pitches);

            if (chord) {
                let startBeat = quantize(tick / ppq);

                if (startBeat < lastChordBeat) {
                    startBeat = lastChordBeat;
                }

                // If there's a gap, insert a rest (NC - No Chord)
                if (startBeat > lastChordBeat) {
                    const restDuration = startBeat - lastChordBeat;
                    chordsStringOutput += `NC:-:${formatDuration(restDuration)} `;
                    measureBeatsChords += restDuration;
                    while (measureBeatsChords >= beatsPerBar - 0.001) {
                        measureNumberChords++;
                        chordsStringOutput += `\n        [${measureNumberChords}] `;
                        measureBeatsChords -= beatsPerBar;
                    }
                }

                // Use the start of the next chord to determine duration.
                // For the last chord, use its own average note duration as a fallback.
                const avgNoteDuration = notes.reduce((sum, n) => sum + n.durationTicks, 0) / notes.length;
                let endBeat = quantize(nextTick ? nextTick / ppq : startBeat + (avgNoteDuration / ppq));
                let duration = endBeat - startBeat;
                if (duration <= 0) duration = 0.5;

                const rootName = midiToNoteName(chord.root);
                chordsStringOutput += `${rootName}:${chord.type}:${formatDuration(duration)} `;
                measureBeatsChords += duration;
                lastChordBeat = startBeat + duration;

                if (i < sortedTicks.length - 1) {
                    while (measureBeatsChords >= beatsPerBar - 0.001) {
                        measureNumberChords++;
                        chordsStringOutput += `\n        [${measureNumberChords}] `;
                        measureBeatsChords -= beatsPerBar;
                    }
                }
            }
        }
        chordsString = chordsStringOutput;
    }

    // If no chords were parsed, use a default placeholder
    if (chordsString.trim() === "") {
        chordsString = `NC:-:4`;
    }

    // Create a generic Title from the tune ID
    const title = tuneId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    const outputCode = `import { parseMelodyString, parseChordsString } from '../tunes.js';\n\nconst originalKey = "${detectedKey}";\n\nexport const tune = {\n    id: "${tuneId}",\n    title: "${title}",\n    originalKey: originalKey,\n    timeSignature: [${timeSig[0]}, ${timeSig[1]}],\n    anacrouse: ${anacrouse},\n    originalTempo: ${tempo},\n    visualTranspose: 0,\n\n\n    melody: parseMelodyString(\`\n        ${melodyString.trim()}\n    \`, originalKey),\n\n\n    chords: parseChordsString(\`\n        ${chordsString.trim()}\n    \`),\n\n    youtube: ""\n};\n`;

    const outputPath = path.join(__dirname, '../data/tuneFiles', `${tuneId}.js`);
    fs.writeFileSync(outputPath, outputCode);
    console.log(`Successfully generated tune file: ${outputPath}`);
    console.log(`Don't forget to add "${tuneId}" to the jazzStandards array in data/tunes.js!`);
}

const args = process.argv.slice(2);
if (args.length < 2) {
    console.log("Usage: node midiToTune.js <path-to-midi-file> <tune-id> [anacrouse-beats]");
    console.log("Example: node midiToTune.js ./my-melody.mid cool-new-tune 1.5");
    process.exit(1);
}

const anacrouse = args.length > 2 ? parseFloat(args[2]) : 0;
convertMidiToTune(args[0], args[1], isNaN(anacrouse) ? 0 : anacrouse);