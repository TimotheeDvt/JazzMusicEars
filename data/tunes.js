/**
 * Jazz Standards Database
 * * Note format: MIDI Numbers (e.g., 60 = Middle C, 61 = C#, 62 = D...)
 * Duration format: Relative lengths (1 = Quarter note, 2 = Half note, 4 = Whole note, 0.5 = Eighth note)
 * Chords format: Absolute root note + chord type quality string
 */
export const jazzStandards = [
    "autumn-leaves",
    // "tune-up",
    // "summertime"
];

// Helper variables for transpositions
export const KEYS = [
    { name: "C", shift: 0 }, { name: "C#", shift: 1 }, { name: "D", shift: 2 },
    { name: "D#", shift: 3 }, { name: "E", shift: 4 }, { name: "F", shift: 5 },
    { name: "F#", shift: 6 }, { name: "G", shift: 7 }, { name: "G#", shift: 8 },
    { name: "A", shift: 9 }, { name: "A#", shift: 10 }, { name: "B", shift: 11 }
];

// Helper to convert simple text notation into melody arrays
// Format: "NoteOctave:Duration" -> e.g., "C4:1 D4:0.5 Eb4:1 | G4:5"
export function parseMelodyString(melodyStr, keyName = "C") {
    const tokens = melodyStr.trim().split(/\s+/);
    const melody = [];
    let currentBeat = 0;

    const getKeyAccidentals = (key) => {
        const normalizedKey = key.replace(/maj/i, '').replace(/min/i, 'm');
        const keyMap = {
            "C": 0, "Am": 0, "G": 1, "Em": 1, "D": 2, "Bm": 2,
            "A": 3, "F#m": 3, "E": 4, "C#m": 4, "B": 5, "G#m": 5, "F#": 6,
            "F": -1, "Dm": -1, "A#": -2, "Gm": -2, "D#": -3, "Cm": -3,
            "G#": -4, "Fm": -4, "C#": -5, "A#m": -5, "D#m": -6
        };
        const sig = keyMap[normalizedKey] || 0;
        const acc = {};
        if (sig > 0) {
            const sharps = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
            for (let i = 0; i < sig; i++) acc[sharps[i]] = '#';
        } else if (sig < 0) {
            const flats = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
            for (let i = 0; i < Math.abs(sig); i++) acc[flats[i]] = 'b';
        }
        return acc;
    };

    const keyAccs = getKeyAccidentals(keyName);

    const noteToMidi = (noteStr) => {
        const match = noteStr.match(/^([A-G])([#bn]?)(-?\d+)$/i);
        if (!match) return null;
        let [, note, acc, oct] = match;
        note = note.toUpperCase();

        // Apply key signature if no explicit accidental was provided
        if (!acc) {
            if (keyAccs[note]) acc = keyAccs[note];
        } else if (acc.toLowerCase() === 'n') {
            acc = ''; // Natural overrides key signature
        }

        const notes = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
        let pitch = notes[note] + (parseInt(oct) + 1) * 12;
        if (acc === '#') pitch += 1;
        if (acc === 'b') pitch -= 1;
        return pitch;
    };

    for (const token of tokens) {
        if (token === '|') {
            melody.push('BAR');
            continue;
        }

        // Handle bare numbers as rest durations (e.g. "1", "0.5")
        if (!isNaN(token)) {
            const duration = parseFloat(token);
            melody.push({ isRest: true, duration: duration, beat: currentBeat });
            currentBeat += duration;
            continue;
        }

        const [notePartRaw, durPart] = token.split(':');
        if (!notePartRaw || !durPart) continue;

        let isTied = false;
        let notePart = notePartRaw;
        if (notePart.startsWith('-')) {
            isTied = true;
            notePart = notePart.substring(1);
        }

        const duration = parseFloat(durPart);

        if (notePart.toUpperCase() === 'R') {
            melody.push({ isRest: true, duration: duration, beat: currentBeat });
            currentBeat += duration;
            continue;
        }

        const pitch = noteToMidi(notePart);
        if (pitch !== null) {
            melody.push({ pitch, duration: duration, beat: currentBeat, tied: isTied });
            currentBeat += duration;
        }
    }
    return melody;
}

// Helper to convert simple text notation into chord arrays
// Format: "RootOctave:Type:Duration" -> e.g., "C4:m7:4 F4:7:4"
export function parseChordsString(chordStr) {
    const tokens = chordStr.trim().split(/\s+/);
    const chords = [];
    let currentBeat = 0;

    for (const token of tokens) {
        if (token === '|') continue;
        const [rootPart, typePart, durPart] = token.split(':');
        if (!rootPart || !typePart || !durPart) continue;

        const duration = parseFloat(durPart);

        if (rootPart.toUpperCase() === 'NC') {
            currentBeat += duration;
            continue;
        }

        // Re-use melody parser logic to get the MIDI root note
        // If no octave is provided in the string (e.g. "C"), default it to 4
        const rootStrWithOctave = rootPart.match(/\d$/) ? rootPart : `${rootPart}4`;
        const parsed = parseMelodyString(`${rootStrWithOctave}:1`, "C"); // Force C to keep root absolute
        if (parsed.length > 0) {
            chords.push({ root: parsed[0].pitch, type: typePart, duration: duration, beat: currentBeat });
            currentBeat += duration;
        }
    }
    return chords;
}