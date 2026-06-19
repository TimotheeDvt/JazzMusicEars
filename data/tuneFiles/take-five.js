import { parseMelodyString, parseChordsString } from '../tunes.js';

const originalKey = "Ebm";

export const tune = {
    id: "take-five",
    title: "Take Five",
    originalKey: originalKey,
    timeSignature: [5, 4],
    anacrouse: 2,
    originalTempo: 168,
    visualTranspose: 0,

    melody: parseMelodyString(`
        [1] Bb3:0.5 Eb4:0.5 Gb4:0.5 Ab4:0.5
        [2] A4:0.5 Bb4:0.5 A4:0.5 Ab4:0.5 Gb4:1
        [2] Bb3:1 Db4:1 Eb4:3
        [3] F4:0.25 Gb4:0.25 F4:0.25 Eb4:0.25 Db4:1 Eb4:3
        [4] Db4:0.25 Eb4:0.25 Db4:0.25 Bb3:0.25 Ab3:1 Bb3:3
        [5] Bb3:0.5 Eb4:0.5 Gb4:0.5 Ab4:0.5 A4:0.5 Bb4:0.5 A4:0.5 Ab4:0.5 Gb4:1
        [6] Bb3:1 Db4:1 Eb4:3
        [7] Db4:0.25 Eb4:0.25 Db4:0.25 Bb3:0.25 Ab3:1 Bb3:3
        [8] F4:0.25 Gb4:0.25 F4:0.25 Eb4:0.25 Db4:1 Eb4:4
        [9] 1 Eb5:0.5 Gb5:1 Eb5:0.5 B4:1
        [10] Ab4:0.5 Bb4:0.5 B4:0.5 C5:0.5 Db5:0.5 F5:1 Db5:0.5 Bb4:1
        [11] Gb4:0.5 Ab4:0.5 A4:0.5 Bb4:0.5 B4:0.5 Eb5:1 B4:0.5 Ab4:1
        [12] F4:0.5 Gb4:0.5 Ab4:0.5 A4:0.5 Bb4:0.5 A4:0.5 Bb4:0.5 B4:0.5 Db5:1
        [13] Db5:0.5 C5:0.5 Db5:0.5 D5:0.5 Eb5:0.5 Gb5:1 Eb5:0.5 B4:1
        [14] Ab4:0.5 Bb4:0.5 B4:0.5 C5:0.5 Db5:0.5 F5:1 Db5:0.5 Bb4:1
        [15] Gb4:0.5 Ab4:0.5 A4:0.5 Bb4:0.5 B4:0.5 Eb5:1 B4:0.5 Ab4:1
        [16] F4:0.5 Ab4:0.5 Db5:0.5 B4:0.5 Bb4:3
        [17] Bb3:0.5 Eb4:0.5 Gb4:0.5 Ab4:0.5 A4:0.5 Bb4:0.5 A4:0.5 Ab4:0.5 Gb4:1
        [18] Bb3:1 Db4:1 Eb4:3
        [19] F4:0.25 Gb4:0.25 F4:0.25 Eb4:0.25 Db4:1 Eb4:3
        [20] Db4:0.25 Eb4:0.25 Db4:0.25 Bb3:0.25 Ab3:1 Bb3:3
        [21] Bb3:0.5 Eb4:0.5 Gb4:0.5 Ab4:0.5 A4:0.5 Bb4:0.5 A4:0.5 Ab4:0.5 Gb4:1
        [22] Bb3:1 Db4:1 Eb4:3
        [23] F4:0.25 Gb4:0.25 F4:0.25 Eb4:0.25 Db4:1 Eb4:3
        [24] Db4:0.25 Eb4:0.25 Db4:0.25 Bb3:0.25 Ab3:1 Bb3:2
    `, originalKey),


    chords: parseChordsString(`
        [0] NC:-:2
        [1] Eb4:m:3 Bb4:m7:2
        [2] Eb4:m:3 Bb4:m7:2
        [3] Eb4:m:3 Bb4:m7:2
        [4] Eb4:m:3 Bb4:m7:2
        [5] Eb4:m:3 Bb4:m7:2
        [6] Eb4:m:3 Bb4:m7:2
        [7] Eb4:m:3 Bb4:m7:2
        [8] Eb4:m:3 Bb4:m7:2
        [9] Cb4:maj7:3 Ab4:m6:2
        [10] Bb4:m7:3 Eb4:m7:2
        [11] Ab4:m7:3 Db4:7:2
        [12] Gb4:maj:5
        [13] Cb4:maj7:3 Ab4:m6:2
        [14] Bb4:m7:3 Eb4:m7:2
        [15] Ab4:m7:3 Db4:7:2
        [16] F4:m7:3 Bb4:7:2
        [1] Eb4:m:3 Bb4:m7:2
        [2] Eb4:m:3 Bb4:m7:2
        [3] Eb4:m:3 Bb4:m7:2
        [4] Eb4:m:3 Bb4:m7:2
        [5] Eb4:m:3 Bb4:m7:2
        [6] Eb4:m:3 Bb4:m7:2
        [7] Eb4:m:3 Bb4:m7:2
        [8] Eb4:m:3 Bb4:m7:2
    `),

    youtube: "https://youtu.be/vmDDOFXSgAs"
};
