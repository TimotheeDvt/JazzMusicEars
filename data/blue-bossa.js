import { parseMelodyString, parseChordsString } from './tunes.js';

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
        G3:1_4 |: G4:1.5_1 F4:0.5_2 Eb4:0.5_2 D4:1_2 C4:0.5_3 | -C4:3_3 Bb3:1_3 | Ab3:2_4 G4:1.5_1 F4:0.5_2 | \
        -F4:4_2 | F4:1.5_2 Eb4:0.5_2 D4:0.5_2 C4:1_3 Bb3:0.5_3 | -Bb3:3_3 Ab3:1_4 | G3:2_4 F4:1.5_2 Eb4:0.5_2 | \
        -Eb4:4_2 | Eb4:1.5_2 Db4:0.5_3 C4:0.5_3 B3:1_3 Ab3:0.5_4 | -Ab3:3_4 Gb3:1_4 | Gb3:1_4 F3:0.5_4 Bb3:0.5_3 -Bb3:0.5_3 F3:0.5_4 Ab3:1_4 | \
        -Ab3:4_4 | Ab3:1_4 G3:0.5_4 Bb3:0.5_3 -Bb3:2_3 | Ab3:1_4 G3:0.5_4 Bb3:0.5_3 -Bb3:1.5_3 Ab3:0.5_4 | G3:4_4 | \
        -G3:3_4 G3:1_4 :|\
    ", originalKey),

    // {Note|NC}{Octave}:{Quality}:{Duration}
    chords: parseChordsString("\
        NC:-:1 |: C3:m7:4 C3:m7:4 F3:m7:4\
        F3:m7:4 D3:m7b5:4 G3:7:4 C3:m7:4\
        C3:m7:4 Eb3:m7:4 Ab3:7:4 Db3:maj7:4\
        Db3:maj7:4 D3:m7b5:4 G3:7:4 C3:m7:4\
        D3:m7b5:2 G3:7:2 :|\
    "),

    youtube: "https://www.youtube.com/watch?v=zdR7v0WbZbA"
};