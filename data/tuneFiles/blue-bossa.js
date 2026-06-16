import { parseMelodyString, parseChordsString } from '../tunes.js';

const originalKey = "Cm"; // B E A are flats

export const tune = {
    id: "blue-bossa",
    title: "Blue Bossa",
    originalKey: originalKey,
    timeSignature: [4, 4],
    anacrouse: 1,
    originalTempo: 150,
    visualTranspose: 12,

    // {Note}{Octave}:{Duration}_{StringNbr} | {NumberOfTimeForRest}
    melody: parseMelodyString("\
        [1] G3:1_4 |: [2] G4:1.5_1 F4:0.5_2 Eb4:0.5_2 D4:1_2 C4:0.5_3 | [3] -C4:3_3 Bb3:1_3 | [4] Ab3:2_4 G4:1.5_1 F4:0.5_2 | \
        [5] -F4:4_2 | [6] F4:1.5_2 Eb4:0.5_2 D4:0.5_2 C4:1_3 Bb3:0.5_3 | [7] -Bb3:3_3 Ab3:1_4 | [8] G3:2_4 F4:1.5_2 Eb4:0.5_2 | \
        [9] -Eb4:4_2 | [10] Eb4:1.5_2 Db4:0.5_3 C4:0.5_3 B3:1_3 Ab3:0.5_4 | [11] -Ab3:3_4 Gb3:1_4 | [12] Gb3:1_4 F3:0.5_4 Bb3:0.5_3 -Bb3:0.5_3 F3:0.5_4 Ab3:1_4 | \
        [13] -Ab3:4_4 | [14] Ab3:1_4 G3:0.5_4 Bb3:0.5_3 -Bb3:2_3 | [15] Ab3:1_4 G3:0.5_4 Bb3:0.5_3 -Bb3:1.5_3 Ab3:0.5_4 |1 [16] G3:4_4 | \
        [17] -G3:3_4 G3:1_4 :| |2 -G3:4 \
    ", originalKey),

    // {Note|NC}{Octave}:{Quality}:{Duration}
    chords: parseChordsString("\
        [1] NC:-:1 |: [2] C3:m7:4 [3] C3:m7:4 [4] F3:m7:4\
        [5] F3:m7:4 [6] D3:m7b5:4 [7] G3:7:4 [8] C3:m7:4\
        [9] C3:m7:4 [10] Eb3:m7:4 [11] Ab3:7:4 [12] Db3:maj7:4\
        [13] Db3:maj7:4 [14] D3:m7b5:4 [15] G3:7:4 |1 [16] C3:m7:4\
        [17] D3:m7b5:2 G3:7:2 :| |2 NC:-:4\
    "),

    youtube: "https://www.youtube.com/watch?v=zdR7v0WbZbA"
};