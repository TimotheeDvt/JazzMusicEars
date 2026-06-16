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
        [1] E4:1_3 F#4:1_2 G4:1_2 \
        |: [2] C5:4_1 | [3] -C5:1_1 D4:1_3 E4:1_3 F#4:1_2 | [4] B4:2_1 B4:2_1 | \
        [5] -B4:1_1 C4:1_4 D4:1_3 E4:1_3 | [6] A4:4_2 |1 [7] -A4:1_2 B3:1_4 C#4:1_3 D#4:1_3 | [8] G4:4_2 |\
        | [9] 1 E4:1_3 F#4:1_2 G4:1_2 :| \
        |2 [10] -A4:1_2 F#4:1_2 A4:1_2 G4:1_2 | [11] E4:4_3 | [12] -E4:1_3 1 D#4:1_3 E4:1_3 | \
        [13] F#4:1_2 B3:1_4 F#4:2_2 | [14] -F#4:1_2 F#4:1_2 E4:1_3 F#4:1_2 | [15] G4:4_2 | [16] -G4:1_2 G4:1_2 F#4:1_2 G4:1_2 |\
        [17] A4:4_2 | [18] -A4:1_2 D4:1_3 D5:1_1 C5:1_1 | [19] B4:4_1 | [20] -B4:1_1 1 A#4:1_1 B4:1_1 |\
        [21] C5:1_1 C5:1_1 A4:1_2 A4:1_2 | [22] F#4:3_2 C5:1_1 | [23] B4:2_1 B4:2_1 | [24] -B4:3_1 E4:1_3 |\
        [25] A4:3_2 G4:1_2 | [26] F#4:2_2 G4:1_2 B3:1_4 | [27] E4:4_3 |\
    ", originalKey),

    chords: parseChordsString("\
        [1] NC:-:3 |: [2] A3:m7:4 [3] D4:7:4 [4] G3:maj7:4 \
        [5] C4:maj7:4 [6] F#3:m7b5:4 |1 [7] B3:7:4 \
        [8] E3:m7:4 [9] E3:m7:4 :| \
        |2 [10] B3:7:4 [11] E3:m7:4 [12] E3:m7:4 | \
        [13] F#3:m7b5:4 [14] B3:7b9:4 [15] E3:m7:4 [16] E3:m7:4\
        [17] A3:m7:4 [18] D4:7:4 [19] G3:maj7:4 [20] G3:maj7:4\
        [21] F#3:m7b5:4 [22] B3:7b9:4 [23] E3:m7:2 Eb3:7:2 [24] D3:m7:2 Db3:7:2\
        [25] C4:maj7:4 [26] B3:7b9:4 [27] E3:m7:4\
    "),

    youtube: "https://www.youtube.com/watch?v=Gsz3mrnIBd0"
};