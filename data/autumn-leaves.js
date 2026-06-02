export const tune = {
    id: "autumn-leaves",
    title: "Autumn Leaves",
    originalKey: "Gmin", // G minor / Bb major
    // Simple relative MIDI pitches assuming C major/A minor reference for easy tracking
    // We'll define them relative to a base pitch or just absolute MIDI values in original key:
    melody: [
        { pitch: 60, duration: 1 }, // C
        { pitch: 62, duration: 1 }, // D
        { pitch: 63, duration: 1 }, // Eb
        { pitch: 67, duration: 2 }, // G
        { pitch: 59, duration: 1 }, // B
        { pitch: 60, duration: 1 }, // C
        { pitch: 62, duration: 1 }, // D
        { pitch: 65, duration: 2 }  // F
    ],
    chords: [
        { root: 60, type: "m7", duration: 4 },  // Cm7
        { root: 65, type: "7", duration: 4 },   // F7
        { root: 70, type: "maj7", duration: 4 },// Bbmaj7
        { root: 65, type: "maj7", duration: 4 } // Ebmaj7
    ],
    youtube: "https://www.youtube.com/watch?v=8K1O3w6hy_0"
}