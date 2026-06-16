import { parseMelodyString, parseChordsString } from '../tunes.js';

const originalKey = "Em";

export const tune = {
    id: "autumn-leaves",
    title: "Autumn Leaves",
    originalKey: originalKey, // E minor / G major
    timeSignature: [4, 4], // 4/4
    anacrouse: 3, // 3 quarter notes
    originalTempo: 140,

    // Easy String Formatting (Note:Duration)
    melody: parseMelodyString("\
        [0] E4:1_3 F#4:1_2 G4:1_2 \
        |: [1] C5:4_1 | [2] -C5:1_1 D4:1_3 E4:1_3 F#4:1_2 | [3] B4:2_1 B4:2_1 | \
        [4] -B4:1_1 C4:1_4 D4:1_3 E4:1_3 | [5] A4:4_2 |1 [6] -A4:1_2 B3:1_4 C#4:1_3 D#4:1_3 | [7] G4:4_2 |\
        | [8] 1 E4:1_3 F#4:1_2 G4:1_2 :| \
        |2 [9] -A4:1_2 F#4:1_2 A4:1_2 G4:1_2 | [10] E4:4_3 | [11] -E4:1_3 1 D#4:1_3 E4:1_3 | \
        [12] F#4:1_2 B3:1_4 F#4:2_2 | [13] -F#4:1_2 F#4:1_2 E4:1_3 F#4:1_2 | [14] G4:4_2 | [15] -G4:1_2 G4:1_2 F#4:1_2 G4:1_2 |\
        [16] A4:4_2 | [17] -A4:1_2 D4:1_3 D5:1_1 C5:1_1 | [18] B4:4_1 | [19] -B4:1_1 1 A#4:1_1 B4:1_1 |\
        [20] C5:1_1 C5:1_1 A4:1_2 A4:1_2 | [21] F#4:3_2 C5:1_1 | [22] B4:2_1 B4:2_1 | [23] -B4:3_1 E4:1_3 |\
        [24] A4:3_2 G4:1_2 | [25] F#4:2_2 G4:1_2 B3:1_4 | [26] E4:4_3 |\
    ", originalKey),

    chords: parseChordsString("\
        [0] NC:-:3 |: [1] A3:m7:4 [2] D4:7:4 [3] G3:maj7:4 \
        [4] C4:maj7:4 [5] F#3:m7b5:4 |1 [6] B3:7:4 \
        [7] E3:m7:4 [8] E3:m7:4 :| \
        |2 [9] B3:7:4 [10] E3:m7:4 [11] E3:m7:4 | \
        [12] F#3:m7b5:4 [13] B3:7b9:4 [14] E3:m7:4 [15] E3:m7:4\
        [16] A3:m7:4 [17] D4:7:4 [18] G3:maj7:4 [19] G3:maj7:4\
        [20] F#3:m7b5:4 [21] B3:7b9:4 [22] E3:m7:2 Eb3:7:2 [23] D3:m7:2 Db3:7:2\
        [24] C4:maj7:4 [25] B3:7b9:4 [26] E3:m7:4\
    "),

    youtube: "https://www.youtube.com/watch?v=Gsz3mrnIBd0"
};