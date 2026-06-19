import { parseMelodyString, parseChordsString } from '../tunes.js';

const originalKey = "C";

export const tune = {
    id: "tune-up",
    title: "Tune Up",
    originalKey: originalKey,
    timeSignature: [4, 4],
    anacrouse: 0,
    originalTempo: 260,
    visualTranspose: 0,

    melody: parseMelodyString(`
        [1] A4:3 G4:1
        [2] D#4:2 E4:2
        [3] F#4:8
        [5] G4:3 F4:1
        [6] C#4:2 D4:2
        [7] E4:7
        [8] E4:1
        [9] D#4:5
        [10] D#4:1 F4:1 G4:1
        [11] D5:6
        [12] D5:1 C5:1
        [13] A4:5.5
        [14] G4:0.5 A4:0.5 C5:0.5 A4:0.5 G4:0.5
        [15] A4:6
    `, originalKey),


    chords: parseChordsString(`
        [1] E4:m7:4
        [2] A4:7:4
        [3] D4:maj7:8
        [4]
        [5] D4:m7:4
        [6] G4:7:4
        [7] C4:maj7:8
        [8]
        [9] C4:m7:4
        [10] F4:7:4
        [11] Bb4:maj7:4
        [12] Eb4:maj7:4
        [13] E4:m7:4
        [14] A4:7:4
        [15] Bb4:maj7:4
        [16] E4:m7:2 A4:7:2
    `),

    youtube: "https://youtu.be/_qg38SZtaDI"
};