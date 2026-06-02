/**
 * Jazz Standards Database
 * * Note format: MIDI Numbers (e.g., 60 = Middle C, 61 = C#, 62 = D...)
 * Duration format: Relative lengths (1 = Quarter note, 2 = Half note, 4 = Whole note, 0.5 = Eighth note)
 * Chords format: Absolute root note + chord type quality string
 */
export const jazzStandards = [
    "autumn-leaves",
    "tune-up",
    "summertime"
];

// Helper variables for transpositions
export const KEYS = [
    { name: "C", shift: 0 }, { name: "C#", shift: 1 }, { name: "D", shift: 2 },
    { name: "D#", shift: 3 }, { name: "E", shift: 4 }, { name: "F", shift: 5 },
    { name: "F#", shift: 6 }, { name: "G", shift: 7 }, { name: "G#", shift: 8 },
    { name: "A", shift: 9 }, { name: "A#", shift: 10 }, { name: "B", shift: 11 }
];