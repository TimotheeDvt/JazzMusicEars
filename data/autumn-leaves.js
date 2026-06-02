import { parseMelodyString, parseChordsString } from './tunes.js';

const originalKey = "Emin";

export const tune = {
    id: "autumn-leaves",
    title: "Autumn Leaves",
    originalKey: originalKey, // E minor / G major
    timeSignature: [4, 4], // 4/4
    anacrouse: 3, // 3 quarter notes

    // Easy String Formatting (Note:Duration)
    melody: parseMelodyString("E4:1 F#4:1 G4:1 | C5:4 | D4:1 E4:1 F#4:1 | B4:4 | C4:1 D4:1 E4:1 | A4:4", originalKey),

    // Added 'NC:-:3' to delay the first chord by 3 beats, aligning it perfectly with the end of the pickup measure
    chords: parseChordsString("NC:-:3 A3:m7:4 D4:7:4 G3:maj7:4 C4:maj7:4 F#3:m7b5:4 B3:7:4 E3:m7:4"),

    youtube: "https://www.youtube.com/watch?v=8K1O3w6hy_0"
};