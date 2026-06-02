import { parseMelodyString, parseChordsString } from './tunes.js';

const originalKey = "Em";

export const tune = {
    id: "autumn-leaves",
    title: "Autumn Leaves",
    originalKey: originalKey, // E minor / G major
    timeSignature: [4, 4], // 4/4
    anacrouse: 3, // 3 quarter notes

    // Easy String Formatting (Note:Duration)
    melody: parseMelodyString("\
        E4:1 F#4:1 G4:1 | C5:4 | -C5:1 D4:1 E4:1 F#4:1 | B4:2 B4:2 | \
        -B4:1 C4:1 D4:1 E4:1 | A4:4 | -A4:1 B3:1 C#4:1 D#4:1 | G4:4 |\
        1 E4:1 F#4:1 G4:1 | C5:4 | -C5:1 D4:1 E4:1 F#4:1 | B4:2 B4:2 | \
        -B4:1 C4:1 D4:1 E4:1 | A4:4 | \
        -A4:1 F#4:1 A4:1 G4:1 | E4:4 | -E4:1 1 D#4:1 E4:1 |\
        F#4:1 B3:1 F#4:2 | -F#4:1 F#4:1 E4:1 F#4:1 | G4:4 | -G4:1 G4:1 F#4:1 G4:1 |\
        A4:4 | -A4:1 D4:1 D5:1 C5:1 | B4:4 | -B4:1 1 A#4:1 B4:1 |\
        C5:1 C5:1 A4:1 A4:1 | F#4:3 C5:1 | B4:2 B4:2 | -B4:3 E4:1 |\
        A4:3 G4:1 | F#4:2 G4:1 B3:1 | E4:4 |\
    ", originalKey),

    chords: parseChordsString("\
        NC:-:3 A3:m7:4 D4:7:4 G3:maj7:4 \
        C4:maj7:4 F#3:m7b5:4 B3:7:4 E3:m7:4\
        NC:-:4 A3:m7:4 D4:7:4 G3:maj7:4 \
        C4:maj7:4 F#3:m7b5:4 B3:7:4 E3:m7:4 E3:m7:4 \
        F#3:m7b5:4 B3:7b9:4 E3:m7:4 E3:m7:4\
        A3:m7:4 D4:7:4 G3:maj7:4 G3:maj7:4\
        F#3:m7b5:4 B3:7b9:4 E3:m7:2 Eb3:7:2 D3:m7:2 Db3:7:2\
        C4:maj7:4 B3:7b9:4 E3:m7:4\
    "),

    youtube: "https://www.youtube.com/watch?v=Gsz3mrnIBd0"
};