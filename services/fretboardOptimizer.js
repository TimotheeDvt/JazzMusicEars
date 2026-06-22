/**
 * Fretboard Optimizer — Viterbi Dynamic Programming
 *
 * Computes the globally optimal string/fret assignment for a melody sequence
 * by minimizing total positional movement across consecutive notes.
 *
 * Rather than assigning each note to the "first available" string (which
 * produces erratic position jumps), this algorithm treats the entire phrase
 * as a sequence and finds the assignment that minimizes total fret travel.
 *
 * Standard EADGBE tuning, frets 0-15.
 */

/** MIDI pitches of open strings, highest to lowest (string 1-6). */
const OPEN_STRINGS = [64, 59, 55, 50, 45, 40]; // E4, B3, G3, D3, A2, E2

const MAX_FRET = 15;

/**
 * A rest gap larger than this (in beats) breaks a phrase, allowing the
 * optimizer to re-anchor its position for the next musical idea.
 */
const PHRASE_BREAK_BEATS = 3;

// ---------------------------------------------------------------------------
// Core algorithm
// ---------------------------------------------------------------------------

/**
 * Returns every valid (stringNum, fret) placement for a given MIDI pitch.
 * @param {number} midi
 * @returns {{ stringNum: number, fret: number }[]}
 */
function getValidPlacements(midi) {
    const placements = [];
    for (let s = 0; s < OPEN_STRINGS.length; s++) {
        const fret = midi - OPEN_STRINGS[s];
        if (fret >= 0 && fret <= MAX_FRET) {
            placements.push({ stringNum: s + 1, fret });
        }
    }
    return placements;
}

/**
 * Transition cost between two consecutive fretboard positions.
 * Penalises fret travel (the dominant factor) and string crossings
 * (a minor ergonomic penalty, since adjacent-string shifts are easy).
 *
 * @param {{ stringNum: number, fret: number }} a
 * @param {{ stringNum: number, fret: number }} b
 * @returns {number}
 */
function transitionCost(a, b) {
    const fretDistance   = Math.abs(a.fret - b.fret);
    const stringDistance = Math.abs(a.stringNum - b.stringNum) * 0.3;
    return fretDistance + stringDistance;
}

/**
 * Viterbi DP: find the minimum-cost string/fret sequence for a pitch array.
 *
 * The forward pass accumulates the minimum total cost to reach each
 * (noteIndex, placementIndex) state. The backward pass reconstructs the
 * optimal assignment.
 *
 * @param {number[]}        pitches       - MIDI pitches in temporal order
 * @param {(number|null)[]} forcedStrings - per-note string override (1-6) or null
 * @returns {{ stringNum: number, fret: number }[]}
 */
function optimizeFretboard(pitches, forcedStrings) {
    if (pitches.length === 0) return [];

    // Compute median fret of all "first-choice" placements so we can
    // gently anchor the DP toward the phrase's natural register instead
    // of drifting to open position by default.
    const firstFrets = pitches.map(midi => {
        const pts = getValidPlacements(midi);
        return pts.length > 0 ? pts[0].fret : 0;
    });
    const medianFret = [...firstFrets].sort((a, b) => a - b)[Math.floor(firstFrets.length / 2)];

    // Build candidate placement lists, honouring forced-string hints.
    const allPlacements = pitches.map((midi, i) => {
        const forced = forcedStrings?.[i];
        if (forced != null) {
            const fret = midi - OPEN_STRINGS[forced - 1];
            if (fret >= 0 && fret <= MAX_FRET) {
                return [{ stringNum: forced, fret }];
            }
            // Forced string is out of range for this pitch — fall through.
        }
        const pts = getValidPlacements(midi);
        return pts.length > 0 ? pts : [{ stringNum: 1, fret: 0 }]; // last-resort fallback
    });

    // ---- Forward pass ----
    // Seed with a small bias toward the phrase's median fret region so the
    // algorithm anchors in the right register from the start.
    const dp = [
        allPlacements[0].map(placement => ({
            cost: Math.abs(placement.fret - medianFret) * 0.15,
            prev: -1,
        })),
    ];

    for (let i = 1; i < pitches.length; i++) {
        const prevLayer = dp[i - 1];
        const layer = allPlacements[i].map(curr => {
            let bestCost = Infinity;
            let bestPrev = 0;
            for (let k = 0; k < prevLayer.length; k++) {
                const cost = prevLayer[k].cost + transitionCost(allPlacements[i - 1][k], curr);
                if (cost < bestCost) {
                    bestCost = cost;
                    bestPrev = k;
                }
            }
            return { cost: bestCost, prev: bestPrev };
        });
        dp.push(layer);
    }

    // ---- Backtrack from the lowest-cost final state ----
    const lastLayer = dp[dp.length - 1];
    let idx = lastLayer.reduce(
        (best, v, i) => (v.cost < lastLayer[best].cost ? i : best),
        0,
    );

    const result = new Array(pitches.length);
    for (let i = pitches.length - 1; i >= 0; i--) {
        result[i] = allPlacements[i][idx];
        idx = dp[i][idx].prev;
    }
    return result;
}

/**
 * Compute optimal fretboard positions for every pitched note in a melody.
 *
 * The melody is segmented into phrases at rests longer than PHRASE_BREAK_BEATS;
 * the DP runs independently per phrase so the optimizer can re-anchor its
 * position after a significant pause in the music.
 *
 * Author-supplied `stringNum` hints (present on notes before transposition)
 * are passed into the DP as constraints; they are honoured when the requested
 * fret is within range and ignored gracefully otherwise.
 *
 * @param {Object[]} notes - melody array produced by parseMelodyString
 * @returns {Map<number, { stringNum: number, fret: number }>}
 *          Maps melody array index → optimal { stringNum, fret } placement
 */
export function computeOptimalFretPositions(notes) {
    const result    = new Map();
    let phraseIdxs  = [];   // indices of pitched notes in the current phrase
    let lastNoteEnd = 0;    // beat position where the last pitched note ended

    const flushPhrase = () => {
        if (phraseIdxs.length === 0) return;

        const pitches    = phraseIdxs.map(i => notes[i].pitch);
        const forced     = phraseIdxs.map(i => notes[i].stringNum ?? null);
        const placements = optimizeFretboard(pitches, forced);

        phraseIdxs.forEach((noteIdx, pi) => result.set(noteIdx, placements[pi]));
        phraseIdxs = [];
    };

    notes.forEach((note, i) => {
        // Skip structural markers, rests, and anything without a pitch.
        if (
            note.isRest                    ||
            note.pitch == null             ||
            note.type === 'BAR'            ||
            note.type === 'REPEAT_START'   ||
            note.type === 'REPEAT_END'     ||
            note.type === 'ENDING_1'       ||
            note.type === 'ENDING_2'
        ) return;

        // A gap longer than the threshold signals a new musical phrase.
        const gap = note.beat - lastNoteEnd;
        if (phraseIdxs.length > 0 && gap > PHRASE_BREAK_BEATS) {
            flushPhrase();
        }

        phraseIdxs.push(i);
        lastNoteEnd = note.beat + (note.duration ?? 0);
    });

    flushPhrase(); // flush the final phrase
    return result;
}