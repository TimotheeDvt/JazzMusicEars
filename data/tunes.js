/**
 * Jazz Standards Database
 * * Note format: MIDI Numbers (e.g., 60 = Middle C, 61 = C#, 62 = D...)
 * Duration format: Relative lengths (1 = Quarter note, 2 = Half note, 4 = Whole note, 0.5 = Eighth note)
 * Chords format: Absolute root note + chord type quality string
 */
export const jazzStandards = [
    "autumn-leaves",
    "blue-bossa"
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
    const rawElements = [];
    let visualBeat = 0;

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
        if (token === '|:') {
            rawElements.push({ type: 'REPEAT_START', visualBeat });
            continue;
        }
        if (token === ':|') {
            rawElements.push({ type: 'REPEAT_END', visualBeat });
            continue;
        }
        if (token === '|1') {
            rawElements.push({ type: 'ENDING_1', visualBeat });
            continue;
        }
        if (token === '|2') {
            rawElements.push({ type: 'ENDING_2', visualBeat });
            continue;
        }
        if (token === '|') {
            rawElements.push({ type: 'BAR', visualBeat });
            continue;
        }

        // Handle bare numbers as rest durations (e.g. "1", "0.5")
        if (!isNaN(token)) {
            const duration = parseFloat(token);
            rawElements.push({ isRest: true, duration: duration, visualBeat });
            visualBeat += duration;
            continue;
        }

        const [notePartRaw, durStrPart] = token.split(':');
        let [durPart, strPart] = durStrPart.split('_');
        if (!notePartRaw || !durPart) continue;

        let notePart = notePartRaw;
        let stringNum = null;

        if (strPart) {
            const strMatch = strPart.match(/([1-6])$/);
            if (strMatch) {
                stringNum = parseInt(strMatch[1], 10);
                strPart = strPart.replace(/([1-6])$/, '');
            }
        }

        let isTied = false;
        if (notePart.startsWith('-')) {
            isTied = true;
            notePart = notePart.substring(1);
        }

        const duration = parseFloat(durPart);

        if (notePart.toUpperCase() === 'R') {
            rawElements.push({ isRest: true, duration: duration, visualBeat });
            visualBeat += duration;
            continue;
        }

        const pitch = noteToMidi(notePart);
        if (pitch !== null) {
            const noteObj = { pitch, duration: duration, visualBeat, tied: isTied };
            if (stringNum !== null) noteObj.stringNum = stringNum;
            rawElements.push(noteObj);
            visualBeat += duration;
        }
    }

    // Unroll repeats to generate linear audio beats
    const melody = [];
    let repeatStartIdx = -1;
    let ending1StartIdx = -1;
    let audioBeat = 0;
    for (let i = 0; i < rawElements.length; i++) {
        let el = rawElements[i];
        if (el.type === 'REPEAT_START') {
            repeatStartIdx = i + 1;
            ending1StartIdx = -1;
            melody.push({ ...el, beat: audioBeat });
        } else if (el.type === 'ENDING_1') {
            ending1StartIdx = i;
            melody.push({ ...el, beat: audioBeat });
        } else if (el.type === 'ENDING_2') {
            melody.push({ ...el, beat: audioBeat });
        } else if (el.type === 'REPEAT_END') {
            melody.push({ ...el, beat: audioBeat });
            let endOfCommon = (ending1StartIdx !== -1) ? ending1StartIdx : i;
            let copy = rawElements.slice(repeatStartIdx, endOfCommon);
            for (let c of copy) {
                let newEl = { ...c, isRepeat: true, beat: audioBeat };
                melody.push(newEl);
                if (c.duration) audioBeat += c.duration;
            }
            repeatStartIdx = -1;
            ending1StartIdx = -1;
        } else {
            let newEl = { ...el, beat: audioBeat };
            melody.push(newEl);
            if (el.duration) audioBeat += el.duration;
        }
    }

    return melody;
}

// Helper to convert simple text notation into chord arrays
// Format: "RootOctave:Type:Duration" -> e.g., "C4:m7:4 F4:7:4"
export function parseChordsString(chordStr) {
    const tokens = chordStr.trim().split(/\s+/);
    const rawElements = [];
    let visualBeat = 0;

    for (const token of tokens) {
        if (token === '|:') {
            rawElements.push({ type: 'REPEAT_START', visualBeat });
            continue;
        }
        if (token === ':|') {
            rawElements.push({ type: 'REPEAT_END', visualBeat });
            continue;
        }
        if (token === '|1') {
            rawElements.push({ type: 'ENDING_1', visualBeat });
            continue;
        }
        if (token === '|2') {
            rawElements.push({ type: 'ENDING_2', visualBeat });
            continue;
        }
        if (token === '|') continue;
        const [rootPart, typePart, durPart] = token.split(':');
        if (!rootPart || !typePart || !durPart) continue;

        const duration = parseFloat(durPart);

        if (rootPart.toUpperCase() === 'NC') {
            rawElements.push({ isRest: true, duration, visualBeat });
            visualBeat += duration;
            continue;
        }

        // Re-use melody parser logic to get the MIDI root note
        // If no octave is provided in the string (e.g. "C"), default it to 4
        const rootStrWithOctave = rootPart.match(/\d$/) ? rootPart : `${rootPart}4`;
        const parsed = parseMelodyString(`${rootStrWithOctave}:1`, "C"); // Force C to keep root absolute
        if (parsed.length > 0) {
            rawElements.push({ root: parsed[0].pitch, type: typePart, duration, visualBeat });
            visualBeat += duration;
        }
    }

    // Unroll repeats for chords
    const chords = [];
    let repeatStartIdx = -1;
    let ending1StartIdx = -1;
    let audioBeat = 0;
    for (let i = 0; i < rawElements.length; i++) {
        let el = rawElements[i];
        if (el.type === 'REPEAT_START') {
            repeatStartIdx = i + 1;
            ending1StartIdx = -1;
            chords.push({ ...el, beat: audioBeat });
        } else if (el.type === 'ENDING_1') {
            ending1StartIdx = i;
            chords.push({ ...el, beat: audioBeat });
        } else if (el.type === 'ENDING_2') {
            chords.push({ ...el, beat: audioBeat });
        } else if (el.type === 'REPEAT_END') {
            chords.push({ ...el, beat: audioBeat });
            let endOfCommon = (ending1StartIdx !== -1) ? ending1StartIdx : i;
            let copy = rawElements.slice(repeatStartIdx, endOfCommon);
            for (let c of copy) {
                let newEl = { ...c, isRepeat: true, beat: audioBeat };
                chords.push(newEl);
                if (c.duration) audioBeat += c.duration;
            }
            repeatStartIdx = -1;
            ending1StartIdx = -1;
        } else {
            let newEl = { ...el, beat: audioBeat };
            chords.push(newEl);
            if (el.duration) audioBeat += el.duration;
        }
    }

    return chords.filter(c => !c.isRest && c.root !== undefined);
}