/**
 * Fretboard Optimizer — Box-Anchored Viterbi Dynamic Programming (Sub-12th Fret Cap)
 *
 * Computes globally optimal string/fret assignments for a melody sequence
 * by constraining positions into coherent, compact hand position frames
 * resembling standard CAGED positions (typically spanning 4-5 frets),
 * heavily prioritizing positions under the 12th fret.
 *
 * Standard EADGBE tuning, frets 0-15.
 */

/** MIDI pitches of open strings, highest to lowest (string 1-6). */
const OPEN_STRINGS = [64, 59, 55, 50, 45, 40]; // E4, B3, G3, D3, A2, E2

const MAX_FRET = 15;

/**
 * A rest gap larger than this (in beats) breaks a phrase, allowing the
 * optimizer to re-anchor its box position for the next musical idea.
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
 * Penalizes large fret stretches outside the box context and balances string crossings.
 *
 * @param {Object} a - Previous placement { stringNum, fret }
 * @param {Object} b - Current placement { stringNum, fret }
 * @returns {number}
 */
function transitionCost(a, b) {
    const fretDistance = Math.abs(a.fret - b.fret);
    const stringDistance = Math.abs(a.stringNum - b.stringNum) * 0.4;

    // Heavily penalize structural stretches exceeding standard 4-fret box widths
    let boxStretchPenalty = 0;
    if (fretDistance > 4) {
        boxStretchPenalty = (fretDistance - 4) * 6;
    }

    return fretDistance + boxStretchPenalty + stringDistance;
}

/**
 * Pre-scans a musical phrase to determine the optimal CAGED-like box position anchor fret.
 * Restricts the core search window below the 12th fret to hold layouts in lower positions.
 *
 * @param {number[]} pitches
 * @returns {number} - Optimal center fret for the hand position box
 */
function findOptimalBoxAnchor(pitches) {
    let bestCenter = 5; // Default safe anchor (5th position)
    let minTotalCost = Infinity;

    // Constrain the box centers between frets 2 and 9. 
    // An anchor center at 9 spans frets 7-11, keeping the entire pattern below fret 12.
    for (let c = 2; c <= 9; c++) {
        let currentCost = 0;

        for (const midi of pitches) {
            const placements = getValidPlacements(midi);
            if (placements.length === 0) continue;

            let bestPlacementDist = Infinity;
            for (const p of placements) {
                const dist = Math.abs(p.fret - c);
                if (dist < bestPlacementDist) {
                    bestPlacementDist = dist;
                }
            }

            // Apply a non-linear penalty for notes forcing the player outside this 4-5 fret CAGED box
            if (bestPlacementDist > 2) {
                currentCost += (bestPlacementDist - 2) * 8;
            }
            currentCost += bestPlacementDist * 0.3; // Gentle weight for smooth centering
        }

        if (currentCost < minTotalCost) {
            minTotalCost = currentCost;
            bestCenter = c;
        }
    }
    return bestCenter;
}

/**
 * Viterbi DP: find the minimum-cost string/fret sequence for a pitch array.
 * Incorporates static phrase box constraints and a hard penalty for frets >= 12.
 *
 * @param {number[]}        pitches       - MIDI pitches in temporal order
 * @param {(number|null)[]} forcedStrings - per-note string override (1-6) or null
 * @returns {{ stringNum: number, fret: number }[]}
 */
function optimizeFretboard(pitches, forcedStrings) {
    if (pitches.length === 0) return [];

    // Find the ideal compact hand position anchor below fret 12
    const boxAnchor = findOptimalBoxAnchor(pitches);

    // Build candidate placement lists, honoring forced-string hints.
    const allPlacements = pitches.map((midi, i) => {
        const forced = forcedStrings?.[i];
        if (forced != null) {
            const fret = midi - OPEN_STRINGS[forced - 1];
            if (fret >= 0 && fret <= MAX_FRET) {
                return [{ stringNum: forced, fret }];
            }
        }
        const pts = getValidPlacements(midi);
        return pts.length > 0 ? pts : [{ stringNum: 1, fret: 0 }]; // Fallback
    });

    // Helper to calculate the baseline costs of a specific fret layout node configuration
    const getFretStateCost = (placement) => {
        const boxDeviation = Math.abs(placement.fret - boxAnchor);
        let cost = (boxDeviation > 2 ? (boxDeviation - 2) * 5 : 0) + boxDeviation * 0.2;

        // Add a severe penalty if the algorithm tries to stray into or past the 12th fret
        if (placement.fret >= 12) {
            cost += (placement.fret - 11) * 50;
        }
        return cost;
    };

    // ---- Forward pass ----
    const dp = [
        allPlacements[0].map(placement => ({
            cost: getFretStateCost(placement),
            prev: -1,
        })),
    ];

    for (let i = 1; i < pitches.length; i++) {
        const prevLayer = dp[i - 1];
        const layer = allPlacements[i].map(curr => {
            let bestCost = Infinity;
            let bestPrev = 0;
            const stateCost = getFretStateCost(curr);

            for (let k = 0; k < prevLayer.length; k++) {
                const cost = prevLayer[k].cost + transitionCost(allPlacements[i - 1][k], curr) + stateCost;
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
 * @param {Object[]} notes - melody array produced by parseMelodyString
 * @returns {Map<number, { stringNum: number, fret: number }>}
 */
export function computeOptimalFretPositions(notes) {
    const result = new Map();
    let phraseIdxs = [];
    let lastNoteEnd = 0;

    const flushPhrase = () => {
        if (phraseIdxs.length === 0) return;

        const pitches = phraseIdxs.map(i => notes[i].pitch);
        const forced = phraseIdxs.map(i => notes[i].stringNum ?? null);
        const placements = optimizeFretboard(pitches, forced);

        phraseIdxs.forEach((noteIdx, pi) => result.set(noteIdx, placements[pi]));
        phraseIdxs = [];
    };

    notes.forEach((note, i) => {
        if (
            note.isRest ||
            note.pitch == null ||
            note.type === 'BAR' ||
            note.type === 'REPEAT_START' ||
            note.type === 'REPEAT_END' ||
            note.type === 'ENDING_1' ||
            note.type === 'ENDING_2'
        ) return;

        const gap = note.beat - lastNoteEnd;
        if (phraseIdxs.length > 0 && gap > PHRASE_BREAK_BEATS) {
            flushPhrase();
        }

        phraseIdxs.push(i);
        lastNoteEnd = note.beat + (note.duration ?? 0);
    });

    flushPhrase();
    return result;
}