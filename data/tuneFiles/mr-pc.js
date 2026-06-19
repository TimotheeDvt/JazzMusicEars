import { parseMelodyString, parseChordsString } from '../tunes.js';

const originalKey = "Eb";

export const tune = {
    id: "mr-pc",
    title: "Mr. P.C.",
    originalKey: originalKey,
    timeSignature: [4, 4],
    anacrouse: 0.5,
    originalTempo: 130,
    visualTranspose: 0,


    melody: parseMelodyString(`
        [1] G3:0.5 C4:0.5 C4:0.5 D4:0.5 D4:0.5 D#4:0.5 D#4:0.5 F4:1
        [2] G4:1.5 F4:0.5 D#4:0.5 C4:0.5 1
        [3] C4:2 A#3:1.5
        [4] C4:0.5 3.5
        [5] G4:0.5 F4:0.5 F4:0.5 G4:0.5 G4:0.5 G#4:0.5 G#4:0.5 A#4:1
        [6] C5:1.5 A#4:0.5 G#4:0.5 F4:0.5 D#4:1
        [7] C4:2 A#3:1 D#4:0.5
        [8] C4:0.5 2 D#4:0.5 C4:0.5 D#4:0.5
        [9] F#4:0.5 0.5 F4:3
        [10] F#4:0.5 0.5 F4:1 D#4:0.5 F4:0.5 D#4:0.5 C4:0.5
        [11] A#3:0.5 C4:2 A#3:1.5
        [12] C4:0.5 0.5 B3:0.5 F4:0.5 A#4:2
    `, originalKey),


    chords: parseChordsString(`
        [1] NC:-:0.5 C4:m7:16
        [2]
        [3]
        [4]
        [5] F4:m7:8
        [6]
        [7] C4:m7:8
        [8]
        [9] Ab4:7:4
        [10] G4:7b9:4
        [11] C4:m7:4
        [12] G4:7#9:4
    `),

    youtube: ""
};
