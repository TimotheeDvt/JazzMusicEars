/**
 * Jazz Standards Database
 * * Note format: MIDI Numbers (e.g., 60 = Middle C, 61 = C#, 62 = D...)
 * Duration format: Relative lengths (1 = Quarter note, 2 = Half note, 4 = Whole note, 0.5 = Eighth note)
 * Chords format: Absolute root note + chord type quality string
 */
export const jazzStandards = [
    {
        id: "autumn-leaves",
        title: "Autumn Leaves",
        originalKey: "Gmin", // G minor / Bb major
        // Simple relative MIDI pitches assuming C major/A minor reference for easy tracking
        // We'll define them relative to a base pitch or just absolute MIDI values in original key:
        melody: [
            { pitch: 60, duration: 1 }, // C
            { pitch: 62, duration: 1 }, // D
            { pitch: 63, duration: 1 }, // Eb
            { pitch: 67, duration: 2 }, // G
            { pitch: 59, duration: 1 }, // B
            { pitch: 60, duration: 1 }, // C
            { pitch: 62, duration: 1 }, // D
            { pitch: 65, duration: 2 }  // F
        ],
        chords: [
            { root: 60, type: "m7", duration: 4 },  // Cm7
            { root: 65, type: "7", duration: 4 },   // F7
            { root: 70, type: "maj7", duration: 4 },// Bbmaj7
            { root: 65, type: "maj7", duration: 4 } // Ebmaj7
        ],
        youtube: "https://www.youtube.com/watch?v=8K1O3w6hy_0"
    },
    {
        id: "tune-up",
        title: "Tune Up",
        originalKey: "Dmaj",
        melody: [
            { pitch: 69, duration: 2 }, // A
            { pitch: 67, duration: 1 }, // G
            { pitch: 66, duration: 1 }, // F#
            { pitch: 64, duration: 4 }  // E
        ],
        chords: [
            { root: 62, type: "m7", duration: 4 }, // Em7
            { root: 62, type: "7", duration: 4 },   // A7
            { root: 62, type: "maj7", duration: 8 } // Dmaj7
        ],
        youtube: "https://www.youtube.com/watch?v=3g8K9gXitb0"
    },
    {
        id: "summertime",
        title: "Summertime",
        originalKey: "Amin",
        melody: [
            { pitch: 64, duration: 2 }, // E
            { pitch: 60, duration: 1 }, // C
            { pitch: 64, duration: 1 }, // E
            { pitch: 62, duration: 4 }  // D
        ],
        chords: [
            { root: 57, type: "m6", duration: 4 },  // Am6
            { root: 64, type: "7b9", duration: 4 }, // E7b9
            { root: 57, type: "m6", duration: 4 },  // Am6
            { root: 57, type: "m6", duration: 4 }   // Am6
        ],
        youtube: "https://www.youtube.com/watch?v=xivm6BiV3O0"
    }
];

// Helper variables for transpositions
export const KEYS = [
    { name: "C", shift: 0 }, { name: "C#", shift: 1 }, { name: "D", shift: 2 },
    { name: "D#", shift: 3 }, { name: "E", shift: 4 }, { name: "F", shift: 5 },
    { name: "F#", shift: 6 }, { name: "G", shift: 7 }, { name: "G#", shift: 8 },
    { name: "A", shift: 9 }, { name: "A#", shift: 10 }, { name: "B", shift: 11 }
];