import { getKeyAccidentals, noteNameToPitch, unrollRepeats } from './tunes.js';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const ACCIDENTAL_TO_SUFFIX = { sharp: '#', flat: 'b', natural: 'n', dblsharp: '##', dblflat: 'bb' };

// Custom app-specific metadata that has no standard ABC field, e.g. "%%youtube <url>".
function extractDirectives(rawAbc) {
    const out = {};
    for (const line of rawAbc.split('\n')) {
        const m = line.match(/^%%(\w+)\s+(.*)$/);
        if (m) out[m[1].toLowerCase()] = m[2].trim();
    }
    return out;
}

function extractHeaders(rawAbc) {
    const headers = {};
    for (const line of rawAbc.split('\n')) {
        const m = line.match(/^([A-Za-z]):\s*(.*)$/);
        if (m) headers[m[1].toUpperCase()] = m[2].trim();
    }
    return headers;
}

function parseTimeSignature(mField) {
    const m = (mField || '').match(/^(\d+)\/(\d+)$/);
    return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : [4, 4];
}

function parseTempo(qField) {
    const m = (qField || '').match(/=\s*(\d+)/);
    return m ? parseInt(m[1], 10) : 120;
}

function unmangleChordName(name) {
    return name.replace(/♯/g, '#').replace(/♭/g, 'b');
}

function splitChordSymbol(name) {
    const m = name.match(/^([A-G])([#b]?)(.*)$/);
    return m ? { letter: m[1], acc: m[2], type: m[3] } : null;
}

export function parseAbc(rawAbc) {
    const directives = extractDirectives(rawAbc);
    const headers = extractHeaders(rawAbc);

    const originalKey = (headers.K || 'C').trim();
    const keyAccs = getKeyAccidentals(originalKey);
    const timeSignature = parseTimeSignature(headers.M);
    const originalTempo = parseTempo(headers.Q);
    const title = headers.T || '';
    const anacrouse = directives.anacrusis !== undefined ? parseFloat(directives.anacrusis) : 0;
    const youtube = directives.youtube || undefined;
    const barDuration = timeSignature[0] * (4 / timeSignature[1]);

    const tunes = ABCJS.parseOnly(rawAbc);
    const tune = tunes[0];

    // ABC line-wraps are purely visual; flatten every voice event across every music line,
    // in authored order, into one continuous stream (mirrors the old DSL's single token stream).
    const events = [];
    for (const line of tune.lines || []) {
        if (!line.staff) continue;
        for (const staff of line.staff) {
            for (const voice of staff.voices) {
                for (const el of voice) events.push(el);
            }
        }
    }

    const rawMelody = [];
    const rawChords = [];
    let visualBeat = 0;

    for (const el of events) {
        if (el.el_type === 'bar') {
            if (el.type === 'bar_left_repeat') {
                rawMelody.push({ type: 'REPEAT_START', visualBeat });
                rawChords.push({ type: 'REPEAT_START', visualBeat });
            }
            if (el.startEnding === '1') {
                rawMelody.push({ type: 'ENDING_1', visualBeat });
                rawChords.push({ type: 'ENDING_1', visualBeat });
            }
            if (el.startEnding === '2') {
                rawMelody.push({ type: 'ENDING_2', visualBeat });
                rawChords.push({ type: 'ENDING_2', visualBeat });
            }
            if (el.type === 'bar_right_repeat') {
                rawMelody.push({ type: 'REPEAT_END', visualBeat });
                rawChords.push({ type: 'REPEAT_END', visualBeat });
            }
            // Plain barlines carry no functional meaning anywhere downstream - skip them.
            continue;
        }

        if (el.el_type !== 'note') continue;

        let stringNum = null;
        if (el.chord) {
            for (const rawC of el.chord) {
                const name = unmangleChordName(rawC.name);
                const stringMatch = name.match(/^S([1-6])$/);
                if (stringMatch) {
                    stringNum = parseInt(stringMatch[1], 10);
                    continue;
                }
                if (/^N\.?C\.?$/i.test(name)) {
                    rawChords.push({ isRest: true, visualBeat });
                    continue;
                }
                const parsed = splitChordSymbol(name);
                if (parsed) {
                    const root = noteNameToPitch(parsed.letter, parsed.acc || undefined, 4, {});
                    rawChords.push({ root, type: parsed.type, visualBeat });
                }
            }
        }

        const duration = el.duration * 4; // event.duration is a fraction of a whole note, independent of L:

        if (el.rest) {
            rawMelody.push({ isRest: true, duration, visualBeat });
            visualBeat += duration;
            continue;
        }

        const p = el.pitches[0];
        const letterIdx = ((p.pitch % 7) + 7) % 7;
        const letter = LETTERS[letterIdx];
        const octave = 4 + Math.floor(p.pitch / 7);
        const explicitAcc = p.accidental ? ACCIDENTAL_TO_SUFFIX[p.accidental] : undefined;
        const pitch = noteNameToPitch(letter, explicitAcc, octave, keyAccs);

        const noteObj = { pitch, duration, visualBeat, tied: !!p.endTie };
        if (stringNum !== null) noteObj.stringNum = stringNum;
        rawMelody.push(noteObj);
        visualBeat += duration;
    }

    if (rawChords.length > 0 && rawChords[0].visualBeat > 0) {
        rawChords.unshift({ isRest: true, visualBeat: 0 });
    }

    for (let i = 0; i < rawChords.length; i++) {
        const cur = rawChords[i];
        if (cur.type !== undefined && cur.root === undefined) continue; // REPEAT_START/END/ENDING_* markers only
        const next = rawChords[i + 1];
        cur.duration = next ? (next.visualBeat - cur.visualBeat) : barDuration;
    }

    const melody = unrollRepeats(rawMelody);
    const chords = unrollRepeats(rawChords).filter(c => !c.isRest && c.root !== undefined);

    return { title, originalKey, timeSignature, anacrouse, originalTempo, melody, chords, youtube };
}

export async function loadTune(id) {
    const rawAbc = await (await fetch(`./data/tuneFiles/${id}.abc`)).text();
    return { id, ...parseAbc(rawAbc) };
}
