import { parseMelodyString, parseChordsString } from './tunes.js';

const originalKey = "Dmaj";

export const tune = {
    id: "tune-up",
    title: "Tune Up",
    originalKey: originalKey,

    melody: parseMelodyString("A4:2 G4:1 F4:1 E4:4", originalKey),
    chords: parseChordsString("E4:m7:4 A4:7:4 D4:maj7:8"),

    youtube: "https://www.youtube.com/watch?v=3g8K9gXitb0"
};