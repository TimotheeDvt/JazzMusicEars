import { parseMelodyString, parseChordsString } from './tunes.js';

const originalKey = "Amin";

export const tune = {
    id: "summertime",
    title: "Summertime",
    originalKey: originalKey,

    melody: parseMelodyString("E4:2 C4:1 E4:1 D4:4", originalKey),
    chords: parseChordsString("A3:m6:4 E4:7b9:4 A3:m6:4 A3:m6:4"),

    youtube: "https://www.youtube.com/watch?v=xivm6BiV3O0"
};