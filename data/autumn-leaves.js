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
        E4:1_3 F#4:1_2 G4:1_2 | C5:4_1 | -C5:1_1 D4:1_3 E4:1_3 F#4:1_2 | B4:2_1 B4:2_1 | \
        -B4:1_1 C4:1_4 D4:1_3 E4:1_3 | A4:4_2 | -A4:1_2 B3:1_4 C#4:1_3 D#4:1_3 | G4:4_2 |\
        1 E4:1_3 F#4:1_2 G4:1_2 | C5:4_1 | -C5:1_1 D4:1_3 E4:1_3 F#4:1_2 | B4:2_1 B4:2_1 | \
        -B4:1_1 C4:1_4 D4:1_3 E4:1_3 | A4:4_2 | \
        -A4:1_2 F#4:1_2 A4:1_2 G4:1_2 | E4:4_3 | -E4:1_3 1 D#4:1_3 E4:1_3 |\
        F#4:1_2 B3:1_4 F#4:2_2 | -F#4:1_2 F#4:1_2 E4:1_3 F#4:1_2 | G4:4_2 | -G4:1_2 G4:1_2 F#4:1_2 G4:1_2 |\
        A4:4_2 | -A4:1_2 D4:1_3 D5:1_1 C5:1_1 | B4:4_1 | -B4:1_1 1 A#4:1_1 B4:1_1 |\
        C5:1_1 C5:1_1 A4:1_2 A4:1_2 | F#4:3_2 C5:1_1 | B4:2_1 B4:2_1 | -B4:3_1 E4:1_3 |\
        A4:3_2 G4:1_2 | F#4:2_2 G4:1_2 B3:1_4 | E4:4_3 |\
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