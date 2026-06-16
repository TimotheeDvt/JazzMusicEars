/**
 * Custom Web Component: <notation-viewer>
 * Renders Standard Notation Clefs and Tablature via Dynamic SVG
 */
export class NotationViewer extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.state = {
            title: "",
            key: "",
            melody: [],
            chords: [],
            revealMelody: 'empty', // 'empty' | 'first' | 'full'
            revealChords: false,
            timeSignature: [4, 4],
            anacrouse: 0,
            displayMode: 'both',
            visualTranspose: 0
        };
    }

    static get observedAttributes() {
        return [];
    }

    connectedCallback() {
        this.render();
    }

    updateData(title, key, melody, chords, revealMelody = 'empty', revealChords = false, timeSignature = [4, 4], anacrouse = 0, displayMode = 'both', visualTranspose = 0) {
        this.state = { title, key, melody, chords, revealMelody, revealChords, timeSignature, anacrouse, displayMode, visualTranspose };
        this.render();
    }

    setPlayhead(beat) {
        const playhead = this.shadowRoot.getElementById('playhead');
        if (!playhead) return;

        if (beat === null || !this.layoutMeasures || this.layoutMeasures.length === 0) {
            playhead.setAttribute('display', 'none');
            const wrapper = this.shadowRoot.querySelector('.score-wrapper');
            if (wrapper && beat === null) {
                wrapper.scrollTo({ top: 0, behavior: 'smooth' });
            }
            return;
        }

        // Map linear audio beat back to spatial visual beat
        let vBeat = beat;
        if (this.state.melody) {
            const activeNote = this.state.melody.find(n => beat >= n.beat - 0.001 && beat < n.beat + (n.duration || 0) - 0.001);
            if (activeNote && activeNote.visualBeat !== undefined) {
                vBeat = activeNote.visualBeat + (beat - activeNote.beat);
            } else {
                const prevNote = [...this.state.melody].reverse().find(n => n.beat <= beat);
                if (prevNote && prevNote.visualBeat !== undefined) {
                    vBeat = prevNote.visualBeat + (beat - prevNote.beat);
                }
            }
        }

        let targetMeasure = this.layoutMeasures.find(m => vBeat >= m.startBeat - 0.001 && vBeat < m.endBeat - 0.001);
        if (!targetMeasure) {
            targetMeasure = this.layoutMeasures[this.layoutMeasures.length - 1];
            if (vBeat > targetMeasure.endBeat) vBeat = targetMeasure.endBeat;
        }

        const MEASURE_PADDING_LEFT = 25;
        const MEASURE_PADDING_RIGHT = 15;

        let x = targetMeasure.startX + MEASURE_PADDING_LEFT;
        const beats = targetMeasure.beats;
        if (beats && beats.length > 0) {
            let prevBeat = targetMeasure.startBeat;
            let prevX = targetMeasure.startX + MEASURE_PADDING_LEFT;

            let nextBeat = targetMeasure.endBeat;
            let nextX = targetMeasure.endX - MEASURE_PADDING_RIGHT;

            for (let i = 0; i < beats.length; i++) {
                if (beats[i] <= vBeat && beats[i] >= prevBeat) {
                    prevBeat = beats[i];
                    prevX = targetMeasure.beatPositions[beats[i]];
                }
                if (beats[i] > vBeat && beats[i] <= nextBeat) {
                    nextBeat = beats[i];
                    nextX = targetMeasure.beatPositions[beats[i]];
                    break;
                }
            }

            if (nextBeat === prevBeat) {
                x = prevX;
            } else {
                const ratio = (vBeat - prevBeat) / (nextBeat - prevBeat);
                x = prevX + ratio * (nextX - prevX);
            }
        } else {
            const ratio = (vBeat - targetMeasure.startBeat) / (targetMeasure.endBeat - targetMeasure.startBeat);
            x = targetMeasure.startX + MEASURE_PADDING_LEFT + ratio * (targetMeasure.endX - targetMeasure.startX - MEASURE_PADDING_LEFT - MEASURE_PADDING_RIGHT);
        }

        const yOffset = targetMeasure.lineIndex * this.layoutSystemHeight + this.layoutTitleHeight;
        let yStart = this.state.displayMode === 'tabs' ? yOffset + this.layoutTabYOffset + 10 : yOffset + 30;
        let yEnd = this.state.displayMode === 'staff' ? yOffset + 110 : yOffset + (this.state.displayMode === 'both' ? this.layoutSystemHeight - 30 : this.layoutTabYOffset + 90);

        playhead.setAttribute('display', 'block');
        playhead.setAttribute('x1', x);
        playhead.setAttribute('x2', x);
        playhead.setAttribute('y1', yStart);
        playhead.setAttribute('y2', yEnd);

        // Auto-scroll to keep the playhead in view
        const wrapper = this.shadowRoot.querySelector('.score-wrapper');
        const svg = this.shadowRoot.querySelector('svg');
        if (wrapper && svg) {
            const scale = svg.clientWidth / 950; // The viewBox width is fixed at 950
            const systemTopPx = yOffset * scale;
            const systemBottomPx = (yOffset + this.layoutSystemHeight) * scale;

            if (systemTopPx < wrapper.scrollTop || systemBottomPx > wrapper.scrollTop + wrapper.clientHeight) {
                wrapper.scrollTo({ top: systemTopPx, behavior: 'smooth' });
            }
        }
    }

    // Helper map to convert absolute MIDI numbers into standard string/fret combinations
    // Simple structural mapping for standard EADGBE guitar tuning
    midiToGuitar(midi, forceStringNum = null) {
        const strings = [64, 59, 55, 50, 45, 40]; // E, B, G, D, A, E positions

        if (forceStringNum && forceStringNum >= 1 && forceStringNum <= 6) {
            const rootPitch = strings[forceStringNum - 1];
            return { stringNum: forceStringNum, fret: midi - rootPitch };
        }

        for (let sIdx = 0; sIdx < strings.length; sIdx++) {
            const rootPitch = strings[sIdx];
            if (midi >= rootPitch && midi <= rootPitch + 15) {
                return { stringNum: sIdx + 1, fret: midi - rootPitch };
            }
        }
        return { stringNum: 1, fret: 0 }; // Fallback
    }

    // Helper to transpose key string up or down by semitones
    transposeKeyName(keyName, shift) {
        if (!shift) return keyName;
        const isMinor = keyName.toLowerCase().endsWith('m') || keyName.toLowerCase().endsWith('min');
        let root = keyName.replace(/min|m/i, '');

        const notes = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
        const rootToIdx = {
            'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
            'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
        };

        let idx = rootToIdx[root];
        if (idx === undefined) return keyName;

        let newIdx = ((idx + shift) % 12 + 12) % 12;
        return notes[newIdx] + (isMinor ? 'm' : '');
    }

    // Get standard key signature properties based on scale name
    getKeySignature(keyName) {
        const sharps = [50, 65, 45, 60, 75, 55, 70]; // F, C, G, D, A, E, B
        const flats = [70, 55, 75, 60, 80, 65, 85];  // B, E, A, D, G, C, F

        const keyMap = {
            "C": 0, "Am": 0, "G": 1, "Em": 1, "D": 2, "Bm": 2,
            "A": 3, "F#m": 3, "E": 4, "C#m": 4, "B": 5, "G#m": 5, "F#": 6, "Gb": -6,
            "F": -1, "Dm": -1, "Bb": -2, "A#": -2, "Gm": -2, "Eb": -3, "D#": -3, "Cm": -3,
            "Ab": -4, "G#": -4, "Fm": -4, "Db": -5, "C#": -5, "Bbm": -5, "A#m": -5,
            "Ebm": -6, "D#m": -6
        };

        let sig = keyMap[keyName] || 0;
        let accidentals = [];

        if (sig > 0) {
            for (let i = 0; i < sig; i++) accidentals.push({ symbol: '♯', y: sharps[i] });
        } else if (sig < 0) {
            for (let i = 0; i < Math.abs(sig); i++) accidentals.push({ symbol: '♭', y: flats[i] });
        }

        return accidentals;
    }

    // Convert MIDI pitch to Staff Y position, including accidental tracking
    midiToStaffInfo(midi, keyName) {
        // Identify keys that favor flat notation
        const flatKeys = ["F", "A#", "Bb", "D#", "Eb", "G#", "Ab", "C#", "Db", "Gb", "Dm", "Gm", "Cm", "Fm", "A#m", "Bbm", "D#m", "Ebm"];
        const isFlat = flatKeys.some(k => keyName === k || keyName.startsWith(k + "m")) || (keyName && keyName.includes('b'));

        const flatMappings = [
            { s: 0, a: '' }, { s: 1, a: 'b' }, { s: 1, a: '' }, { s: 2, a: 'b' },
            { s: 2, a: '' }, { s: 3, a: '' }, { s: 4, a: 'b' }, { s: 4, a: '' },
            { s: 5, a: 'b' }, { s: 5, a: '' }, { s: 6, a: 'b' }, { s: 6, a: '' }
        ];
        const sharpMappings = [
            { s: 0, a: '' }, { s: 0, a: '#' }, { s: 1, a: '' }, { s: 1, a: '#' },
            { s: 2, a: '' }, { s: 3, a: '' }, { s: 3, a: '#' }, { s: 4, a: '' },
            { s: 4, a: '#' }, { s: 5, a: '' }, { s: 5, a: '#' }, { s: 6, a: '' }
        ];

        const pc = midi % 12;
        const octave = Math.floor(midi / 12) - 1;
        const mapping = isFlat ? flatMappings[pc] : sharpMappings[pc];

        // Key Signature logic to suppress/add accidentals
        const keyMap = {
            "C": 0, "Am": 0, "G": 1, "Em": 1, "D": 2, "Bm": 2,
            "A": 3, "F#m": 3, "E": 4, "C#m": 4, "B": 5, "G#m": 5, "F#": 6, "Gb": -6,
            "F": -1, "Dm": -1, "Bb": -2, "A#": -2, "Gm": -2, "Eb": -3, "D#": -3, "Cm": -3,
            "Ab": -4, "G#": -4, "Fm": -4, "Db": -5, "C#": -5, "Bbm": -5, "A#m": -5,
            "Ebm": -6, "D#m": -6
        };
        const sig = keyMap[keyName] || 0;
        const keyAccidentals = {};
        if (sig > 0) {
            const sharpsOrder = [3, 0, 4, 1, 5, 2, 6]; // F, C, G, D, A, E, B
            for (let i = 0; i < sig; i++) keyAccidentals[sharpsOrder[i]] = '#';
        } else if (sig < 0) {
            const flatsOrder = [6, 2, 5, 1, 4, 0, 3]; // B, E, A, D, G, C, F
            for (let i = 0; i < Math.abs(sig); i++) keyAccidentals[flatsOrder[i]] = 'b';
        }

        let finalAccidental = mapping.a;
        if (keyAccidentals[mapping.s]) {
            if (mapping.a === keyAccidentals[mapping.s]) finalAccidental = ''; // Suppress, already in key sig
            else if (mapping.a === '') finalAccidental = 'n'; // Needs natural sign
        }

        const totalStepsFromC4 = (octave - 4) * 7 + mapping.s;
        const y = 100 - (totalStepsFromC4 * 5); // 5 SVG units per diatonic staff step

        return { y, accidental: finalAccidental };
    }

    generateSVG() {
        const { melody, chords, revealMelody, revealChords, key, timeSignature, anacrouse, displayMode, visualTranspose } = this.state;

        let visibleNotes = [];
        let visibleChords = [];

        if (revealMelody === 'first' && melody.length > 0) {
            const firstNote = melody.find(n => n !== 'BAR' && n.type !== 'BAR');
            if (firstNote) visibleNotes = [firstNote];
        } else if (revealMelody === 'full') {
            visibleNotes = melody;
        }
        if (revealChords) {
            visibleChords = chords;
        }

        const tsNum = Array.isArray(timeSignature) ? timeSignature[0] : 4;
        const tsDen = Array.isArray(timeSignature) ? timeSignature[1] : 4;
        const barDuration = tsNum * (4 / tsDen);

        const drawStaff = displayMode !== 'tabs';
        const drawTabs = displayMode !== 'staff';
        const SYSTEM_HEIGHT = displayMode === 'both' ? 260 : 150;
        const tabYOffset = displayMode === 'both' ? 150 : 50;

        const barLineStartY = 50;
        let barLineEndY = 210;
        if (displayMode === 'staff') barLineEndY = 90;
        if (displayMode === 'tabs') barLineEndY = 110;

        const transposedKey = this.transposeKeyName(key, visualTranspose || 0);
        const keySig = this.getKeySignature(transposedKey);
        let kx = 55;
        if (drawStaff) {
            keySig.forEach(() => kx += 12);
        }

        const line0StartX = drawStaff ? Math.max(70, kx + 15) + 30 : 100;
        const lineNStartX = drawStaff ? kx + 20 : 50;

        const WIDTH = 950;

        // Calculate maximum required beats to determine total measures needed
        let maxBeat = 0;
        melody.forEach(n => {
            if (n.isRepeat) return;
            let b = n.visualBeat !== undefined ? n.visualBeat : n.beat;
            if (b !== undefined && n.duration) maxBeat = Math.max(maxBeat, b + n.duration);
        });
        chords.forEach(c => {
            if (c.isRepeat) return;
            let b = c.visualBeat !== undefined ? c.visualBeat : c.beat;
            if (b !== undefined && c.duration) maxBeat = Math.max(maxBeat, b + c.duration);
        });

        let totalMeasures = 1;
        if (maxBeat > 0) {
            if (anacrouse > 0) {
                if (maxBeat <= anacrouse) totalMeasures = 1;
                else totalMeasures = 1 + Math.ceil((maxBeat - anacrouse) / barDuration);
            } else {
                totalMeasures = Math.ceil(maxBeat / barDuration);
            }
        }

        // PRE-PASS: Collect all unique visual event beats
        const allEventBeats = new Set();
        melody.forEach(note => {
            if (note === 'BAR' || note.type === 'BAR' || note.type === 'REPEAT_START' || note.type === 'REPEAT_END' || note.type === 'ENDING_1' || note.type === 'ENDING_2' || note.isRepeat) return;
            let currentNoteBeat = note.visualBeat !== undefined ? note.visualBeat : note.beat;
            let remaining = note.duration;
            let comps = [];
            [4, 3, 2, 1.5, 1, 0.75, 2/3, 0.5, 1/3, 0.25, 1/6].forEach(val => {
                while (remaining >= val - 0.001) {
                    comps.push({ dur: val, beat: currentNoteBeat });
                    allEventBeats.add(currentNoteBeat);
                    currentNoteBeat += val;
                    remaining -= val;
                }
            });
            if (comps.length === 0) {
                comps.push({ dur: 0.5, beat: currentNoteBeat });
                allEventBeats.add(currentNoteBeat);
            }
            note.comps = comps; // Cache for drawing loop
        });
        chords.forEach(c => {
            if (c.isRepeat) return;
            const vBeat = c.visualBeat !== undefined ? c.visualBeat : c.beat;
            if (vBeat !== undefined) allEventBeats.add(vBeat);
        });

        // BUILD MEASURES
        const measures = [];
        for (let m = 0; m < totalMeasures; m++) {
            let startBeat = (anacrouse > 0 && m === 0) ? 0 : (anacrouse > 0 ? anacrouse + (m - 1) * barDuration : m * barDuration);
            let endBeat = anacrouse > 0 ? anacrouse + m * barDuration : (m + 1) * barDuration;

            const measureBeats = Array.from(allEventBeats).filter(b => b >= startBeat - 0.001 && b < endBeat - 0.001);
            measureBeats.sort((a, b) => a - b);

            measures.push({ index: m, startBeat, endBeat, beats: measureBeats });
        }

        // CALCULATE DYNAMIC PROPORTIONAL LAYOUT
        const PIXELS_PER_STEP = 55;
        const MEASURE_PADDING_LEFT = 25;
        const MEASURE_PADDING_RIGHT = 15;

        let currentLine = 0;
        let currentX = line0StartX;

        measures.forEach((measure, idx) => {
            let contentWidth = measure.beats.length * PIXELS_PER_STEP;
            if (measure.beats.length === 0) contentWidth = PIXELS_PER_STEP;
            let measureWidth = MEASURE_PADDING_LEFT + contentWidth + MEASURE_PADDING_RIGHT;

            if (idx > 0 && currentX + measureWidth > WIDTH - 20) {
                currentLine++;
                currentX = lineNStartX;
            }

            measure.lineIndex = currentLine;
            measure.startX = currentX;
            measure.beatPositions = {};
            measure.beats.forEach((b, i) => {
                measure.beatPositions[b] = currentX + MEASURE_PADDING_LEFT + (i * PIXELS_PER_STEP);
            });
            currentX += measureWidth;
            measure.endX = currentX;
        });

        const totalLines = currentLine + 1;
        const TITLE_HEIGHT = revealChords ? 70 : 45;
        const height = totalLines * SYSTEM_HEIGHT + TITLE_HEIGHT;

        let svgHtml = `
            <svg viewBox="0 0 ${WIDTH} ${height}" width="100%" xmlns="http://www.w3.org/2000/svg" style="background:#fff; border:1px solid #cbd5e1; border-radius:4px; display: block; cursor: pointer;">
                <style>
                    .staff-line { stroke: #64748b; stroke-width: 1; }
                    .clef-text { font-family: serif; font-size: 42px; font-weight: bold; fill: #1e293b; }
                    .tab-text { font-family: 'Arial Concrete', sans-serif; font-size: 20px; font-weight: 900; fill: #64748b; }
                    .note-head { fill: #0f172a; }
                    .note-text { font-family: sans-serif; font-size: 11px; font-weight: bold; fill: #fff; text-anchor: middle; }
                    .accidental-text { font-family: serif; font-size: 20px; font-weight: bold; fill: #0f172a; }
                    .chord-label { font-family: 'Kalam', cursive; font-size: 20px; font-weight: bold; fill: #4f46e5; text-anchor: middle; }
                    .time-sig-text { font-family: 'Kalam', cursive; font-size: 32px; font-weight: bold; fill: #1e293b; text-anchor: middle; }
                    .bar-line { stroke: #334155; stroke-width: 2; }
                    text { user-select: none; -webkit-user-select: none; }
                </style>
                <text x="${WIDTH / 2}" y="50" font-family="'Kalam', cursive" font-size="42" font-weight="bold" fill="#1e293b" text-anchor="middle">${this.state.title}</text>
        `;

        // Helper: Converts an absolute beat to an exact (x, lineIndex, yOffset) position
        const getPos = (beat) => {
            let targetMeasure = measures.find(m => beat >= m.startBeat - 0.001 && beat < m.endBeat - 0.001);
            if (!targetMeasure) targetMeasure = measures[measures.length - 1];

            let x = targetMeasure.beatPositions[beat];
            if (x === undefined) x = targetMeasure.startX + MEASURE_PADDING_LEFT;

            return {
                lineIndex: targetMeasure.lineIndex,
                x: x,
                yOffset: targetMeasure.lineIndex * SYSTEM_HEIGHT + TITLE_HEIGHT
            };
        };

        const getMeasureIndexForBeat = (beat) => {
            for (let i = 0; i < measures.length; i++) {
                if (beat >= measures[i].startBeat - 0.001 && beat < measures[i].endBeat - 0.001) {
                    return measures[i].index;
                }
            }
            // Handle beat on the very last barline
            if (measures.length > 0 && Math.abs(beat - measures[measures.length - 1].endBeat) < 0.001) {
                return measures[measures.length - 1].index;
            }
            return -1;
        };

        // --- DRAW MUSICAL SYSTEMS ---
        for (let lineIndex = 0; lineIndex < totalLines; lineIndex++) {
            const yOffset = lineIndex * SYSTEM_HEIGHT + TITLE_HEIGHT;

            // Draw Standard Notation Staff
            if (drawStaff) {
                for (let i = 0; i < 5; i++) {
                    const y = yOffset + 50 + (i * 10);
                    svgHtml += `<line x1="20" y1="${y}" x2="${WIDTH - 20}" y2="${y}" class="staff-line"/>`;
                }
                svgHtml += `<text x="30" y="${yOffset + 83}" class="clef-text">𝄞</text>`;
            }

            // Draw Guitar Tab Staff
            if (drawTabs) {
                for (let i = 0; i < 6; i++) {
                    const y = yOffset + tabYOffset + (i * 12);
                    svgHtml += `<line x1="20" y1="${y}" x2="${WIDTH - 20}" y2="${y}" class="staff-line"/>`;
                }
                svgHtml += `<text x="30" y="${yOffset + tabYOffset + 22}" class="tab-text">T</text>`;
                svgHtml += `<text x="30" y="${yOffset + tabYOffset + 40}" class="tab-text">A</text>`;
                svgHtml += `<text x="30" y="${yOffset + tabYOffset + 58}" class="tab-text">B</text>`;
            }

            // Draw Boundary Barlines
            svgHtml += `<line x1="20" y1="${yOffset + barLineStartY}" x2="20" y2="${yOffset + barLineEndY}" class="bar-line"/>`;
            svgHtml += `<line x1="${WIDTH - 20}" y1="${yOffset + barLineStartY}" x2="${WIDTH - 20}" y2="${yOffset + barLineEndY}" class="bar-line"/>`;

            // Draw Measure Number at the beginning of each line (Skip measure 0 pickups)
            const firstMeasureOnLine = measures.find(m => m.lineIndex === lineIndex);
            if (firstMeasureOnLine) {
                let measureNum = firstMeasureOnLine.index + 1;
                const measureNumX = 8;
                const measureNumY = yOffset + (drawStaff ? 38 : tabYOffset - 5);
                svgHtml += `<text x="${measureNumX}" y="${measureNumY}" font-family="sans-serif" font-size="14" font-weight="bold" fill="#64748b">${measureNum}</text>`;
            }

            if (drawStaff) {
                // Draw Key Signature
                let kxLocal = 55;
                keySig.forEach(acc => {
                    svgHtml += `<text x="${kxLocal}" y="${yOffset + acc.y + 6}" class="accidental-text">${acc.symbol}</text>`;
                    kxLocal += 12;
                });

                // Draw Time Signature (First line only)
                if (lineIndex === 0) {
                    let tsX = Math.max(70, kxLocal + 15);
                    svgHtml += `<text x="${tsX}" y="${yOffset + 68}" class="time-sig-text">${tsNum}</text>`;
                    svgHtml += `<text x="${tsX}" y="${yOffset + 88}" class="time-sig-text">${tsDen}</text>`;
                }
            } else if (drawTabs && lineIndex === 0) {
                let tsX = 65;
                svgHtml += `<text x="${tsX}" y="${yOffset + tabYOffset + 28}" class="time-sig-text">${tsNum}</text>`;
                svgHtml += `<text x="${tsX}" y="${yOffset + tabYOffset + 48}" class="time-sig-text">${tsDen}</text>`;
            }
        }

        // --- DRAW MEASURE BARLINES ---
        for (let i = 0; i < measures.length - 1; i++) {
            const currentMeasure = measures[i];
            const nextMeasure = measures[i + 1];
            if (currentMeasure.lineIndex === nextMeasure.lineIndex) {
                const x = nextMeasure.startX;
                const yOffset = currentMeasure.lineIndex * SYSTEM_HEIGHT + TITLE_HEIGHT;
                svgHtml += `<line x1="${x}" y1="${yOffset + barLineStartY}" x2="${x}" y2="${yOffset + barLineEndY}" class="bar-line"/>`;
            }
        }

        // --- RENDER REVEALED CHORDS ---
        const flatKeysForChords = ["F", "Bb", "Eb", "Ab", "Db", "Gb", "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm"];
        const useFlats = flatKeysForChords.some(k => transposedKey === k || transposedKey.startsWith(k + "m")) || transposedKey.includes('b');
        const sharpRoots = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const flatRoots = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
        const chordRoots = useFlats ? flatRoots : sharpRoots;

        visibleChords.forEach((chord) => {
            if (chord.isRepeat) return;
            const vBeat = chord.visualBeat !== undefined ? chord.visualBeat : chord.beat;
            if (vBeat === undefined) return;
            const pos = getPos(vBeat);

            let displayRoot = chord.root + (visualTranspose || 0);
            displayRoot = ((displayRoot % 12) + 12) % 12;
            const name = chordRoots[displayRoot] + chord.type;
            svgHtml += `<text x="${pos.x}" y="${pos.yOffset + 30}" class="chord-label">${name}</text>`;
        });

        // --- PRE-CALCULATE BEAMS AND POSITIONS ---
        let allComps = [];
        visibleNotes.forEach(note => {
            if (note === 'BAR' || note.type === 'BAR' || note.isRepeat) return;
            if (note.type === 'ENDING_1' || note.type === 'ENDING_2' || note.type === 'REPEAT_START' || note.type === 'REPEAT_END') return;
            if (note.comps) {
                note.comps.forEach(c => {
                    c.isRest = note.isRest;
                    c.pitch = note.pitch;
                    c.stringNum = note.stringNum;
                    c.staffPitch = note.pitch !== undefined ? note.pitch + (visualTranspose || 0) : undefined;
                    allComps.push(c);
                });
            }
        });
        allComps.sort((a, b) => a.beat - b.beat);

        allComps.forEach(comp => {
            if (!comp.isRest) {
                comp.pos = getPos(comp.beat);
                if (comp.staffPitch !== undefined) {
                    comp.staffInfo = this.midiToStaffInfo(comp.staffPitch, transposedKey);
                    comp.staffY = comp.pos.yOffset + comp.staffInfo.y;
                }
                if (comp.pitch !== undefined) {
                    comp.guitar = this.midiToGuitar(comp.pitch, comp.stringNum);
                    comp.tabY = comp.pos.yOffset + tabYOffset + ((comp.guitar.stringNum - 1) * 12);
                }
            }
        });

        let staffBeamGroups = [];
        let tabBeamGroups = [];

        if (drawStaff) {
            let currentGroup = [];
            allComps.forEach(comp => {
                if (comp.isRest || comp.dur > 0.5 + 0.001) {
                    if (currentGroup.length > 1) staffBeamGroups.push(currentGroup);
                    currentGroup = [];
                    return;
                }
                if (currentGroup.length > 0) {
                    let prev = currentGroup[currentGroup.length - 1];
                    if (getMeasureIndexForBeat(prev.beat) !== getMeasureIndexForBeat(comp.beat) || Math.floor(comp.beat) !== Math.floor(prev.beat) || comp.pos.lineIndex !== prev.pos.lineIndex) {
                        if (currentGroup.length > 1) staffBeamGroups.push(currentGroup);
                        currentGroup = [];
                    }
                }
                currentGroup.push(comp);
            });
            if (currentGroup.length > 1) staffBeamGroups.push(currentGroup);
        }

        if (drawTabs) {
            let currentGroup = [];
            allComps.forEach(comp => {
                if (comp.isRest || comp.dur > 0.5 + 0.001) {
                    if (currentGroup.length > 1) tabBeamGroups.push(currentGroup);
                    currentGroup = [];
                    return;
                }
                if (currentGroup.length > 0) {
                    let prev = currentGroup[currentGroup.length - 1];
                    if (getMeasureIndexForBeat(prev.beat) !== getMeasureIndexForBeat(comp.beat) || Math.floor(comp.beat) !== Math.floor(prev.beat) || comp.pos.lineIndex !== prev.pos.lineIndex) {
                        if (currentGroup.length > 1) tabBeamGroups.push(currentGroup);
                        currentGroup = [];
                    }
                }
                currentGroup.push(comp);
            });
            if (currentGroup.length > 1) tabBeamGroups.push(currentGroup);
        }

        staffBeamGroups.forEach(group => {
            let avgY = group.reduce((sum, c) => sum + c.staffY, 0) / group.length;
            let stemDown = avgY <= (group[0].pos.yOffset + 70);
            let extremeY = stemDown ? Math.max(...group.map(c => c.staffY)) + 30 : Math.min(...group.map(c => c.staffY)) - 30;
            
            group.forEach(c => {
                c.isBeamedStaff = true;
                c.stemDownStaff = stemDown;
                c.stemY2Staff = extremeY;
            });
            group.beamY = extremeY;
            group.stemDownStaff = stemDown;
        });

        tabBeamGroups.forEach(group => {
            let extremeY = Math.max(...group.map(c => c.tabY)) + 25;
            group.forEach(c => {
                c.isBeamedTab = true;
                c.stemDownTab = true;
                c.stemY2Tab = extremeY;
            });
            group.beamY = extremeY;
        });

        // --- RENDER REVEALED MELODY NOTES ---
        let globalLastNoteX = null;
        let globalLastNoteY = null;
        let globalLastLineIdx = null;

        visibleNotes.forEach((note) => {
            if (note === 'BAR' || note.type === 'BAR' || note.isRepeat) return;

            const vBeat = note.visualBeat !== undefined ? note.visualBeat : note.beat;
            if (vBeat === undefined) return;

            // Render Repeat Symbols natively into the system measures
            if (note.type === 'ENDING_1' || note.type === 'ENDING_2') {
                let targetMeasure = measures.find(m => vBeat >= m.startBeat - 0.001 && vBeat < m.endBeat - 0.001);
                if (!targetMeasure) targetMeasure = measures[measures.length - 1];
                let barX = targetMeasure.startX;
                const lineYOffset = targetMeasure.lineIndex * SYSTEM_HEIGHT + TITLE_HEIGHT;

                let bracketY = revealChords ? lineYOffset - 10 : (drawStaff ? lineYOffset + 15 : lineYOffset + tabYOffset - 15);
                let textY = bracketY + 14;
                let startY = revealChords ? bracketY + 15 : bracketY + 20;

                const text = note.type === 'ENDING_1' ? '1.' : '2.';
                svgHtml += `<path d="M${barX} ${startY} L${barX} ${bracketY} L${barX + 60} ${bracketY}" fill="none" stroke="#1e293b" stroke-width="1.5"/>`;
                svgHtml += `<text x="${barX + 8}" y="${textY}" font-family="sans-serif" font-size="14" font-weight="bold" fill="#1e293b">${text}</text>`;
                return;
            }

            if (note.type === 'REPEAT_START') {
                let targetMeasure = measures.find(m => vBeat >= m.startBeat - 0.001 && vBeat < m.endBeat - 0.001);
                if (!targetMeasure) targetMeasure = measures[measures.length - 1];
                let barX = targetMeasure.startX;
                const lineYOffset = targetMeasure.lineIndex * SYSTEM_HEIGHT + TITLE_HEIGHT;
                svgHtml += `<line x1="${barX - 2}" y1="${lineYOffset + barLineStartY}" x2="${barX - 2}" y2="${lineYOffset + barLineEndY}" stroke="#334155" stroke-width="4"/>`;
                svgHtml += `<line x1="${barX + 3}" y1="${lineYOffset + barLineStartY}" x2="${barX + 3}" y2="${lineYOffset + barLineEndY}" stroke="#334155" stroke-width="1.5"/>`;
                if (drawStaff) {
                    svgHtml += `<circle cx="${barX + 8}" cy="${lineYOffset + 65}" r="2" fill="#334155"/>`;
                    svgHtml += `<circle cx="${barX + 8}" cy="${lineYOffset + 75}" r="2" fill="#334155"/>`;
                }
                if (drawTabs) {
                    svgHtml += `<circle cx="${barX + 8}" cy="${lineYOffset + tabYOffset + 24}" r="2" fill="#334155"/>`;
                    svgHtml += `<circle cx="${barX + 8}" cy="${lineYOffset + tabYOffset + 36}" r="2" fill="#334155"/>`;
                }
                return;
            }
            if (note.type === 'REPEAT_END') {
                let targetMeasure = measures.find(m => vBeat >= m.startBeat - 0.001 && vBeat < m.endBeat - 0.001);
                let barX = targetMeasure ? targetMeasure.startX : measures[measures.length - 1].endX;
                const lineYOffset = targetMeasure ? targetMeasure.lineIndex * SYSTEM_HEIGHT + TITLE_HEIGHT : (measures[measures.length - 1].lineIndex * SYSTEM_HEIGHT + TITLE_HEIGHT);
                svgHtml += `<line x1="${barX - 3}" y1="${lineYOffset + barLineStartY}" x2="${barX - 3}" y2="${lineYOffset + barLineEndY}" stroke="#334155" stroke-width="1.5"/>`;
                svgHtml += `<line x1="${barX + 2}" y1="${lineYOffset + barLineStartY}" x2="${barX + 2}" y2="${lineYOffset + barLineEndY}" stroke="#334155" stroke-width="4"/>`;
                if (drawStaff) {
                    svgHtml += `<circle cx="${barX - 8}" cy="${lineYOffset + 75}" r="2" fill="#334155"/>`;
                    svgHtml += `<circle cx="${barX - 8}" cy="${lineYOffset + 85}" r="2" fill="#334155"/>`;
                }
                if (drawTabs) {
                    svgHtml += `<circle cx="${barX - 8}" cy="${lineYOffset + tabYOffset + 34}" r="2" fill="#334155"/>`;
                    svgHtml += `<circle cx="${barX - 8}" cy="${lineYOffset + tabYOffset + 46}" r="2" fill="#334155"/>`;
                }
                return;
            }

            if (note.isRest) {
                note.comps.forEach((comp) => {
                    const pos = getPos(comp.beat);

                    if (drawStaff) {
                        if (comp.dur >= 4 - 0.001) {
                            svgHtml += `<rect x="${pos.x - 6}" y="${pos.yOffset + 60}" width="12" height="5" fill="#0f172a"/>`;
                        } else if (comp.dur >= 2 - 0.001) {
                            svgHtml += `<rect x="${pos.x - 6}" y="${pos.yOffset + 65}" width="12" height="5" fill="#0f172a"/>`;
                        } else if (comp.dur >= 2/3 - 0.001) {
                            svgHtml += `<path d="M${pos.x - 3} ${pos.yOffset + 55} L${pos.x + 4} ${pos.yOffset + 65} L${pos.x - 2} ${pos.yOffset + 73} C${pos.x + 5} ${pos.yOffset + 73} ${pos.x + 5} ${pos.yOffset + 84} ${pos.x - 2} ${pos.yOffset + 84} C${pos.x - 4} ${pos.yOffset + 84} ${pos.x - 4} ${pos.yOffset + 80} ${pos.x - 1} ${pos.yOffset + 80}" fill="none" stroke="#0f172a" stroke-width="1.5"/>`;
                        } else if (comp.dur >= 1/6 - 0.001) {
                            svgHtml += `<circle cx="${pos.x - 3}" cy="${pos.yOffset + 64}" r="2" fill="#0f172a"/>`;
                            svgHtml += `<path d="M${pos.x - 3} ${pos.yOffset + 64} Q${pos.x + 5} ${pos.yOffset + 60} ${pos.x + 4} ${pos.yOffset + 70} L${pos.x - 1} ${pos.yOffset + 82}" fill="none" stroke="#0f172a" stroke-width="1.5"/>`;
                        }

                        // Draw Dot for Dotted rests
                        if (Math.abs(comp.dur - 3) < 0.01 || Math.abs(comp.dur - 1.5) < 0.01 || Math.abs(comp.dur - 0.75) < 0.01) {
                            svgHtml += `<circle cx="${pos.x + 10}" cy="${pos.yOffset + 70}" r="2" class="note-head"/>`;
                        }
                    }
                });
                return;
            }

            const staffPitch = note.pitch + (visualTranspose || 0);
            const staffInfo = this.midiToStaffInfo(staffPitch, transposedKey);
            const guitar = this.midiToGuitar(note.pitch, note.stringNum);
            const noteStartPos = getPos(vBeat);

            // Draw Accidental (Once per actual note)
            if (drawStaff && staffInfo.accidental) {
                const accSymbol = staffInfo.accidental === 'n' ? '♮' : (staffInfo.accidental === 'b' ? '♭' : '♯');
                svgHtml += `<text x="${noteStartPos.x - 20}" y="${noteStartPos.yOffset + staffInfo.y + 6}" class="accidental-text">${accSymbol}</text>`;
            }

            // Decompose duration into standard visual components (e.g., 5 becomes a Whole Note tied to a Quarter Note)
            note.comps.forEach((comp, idx) => {
                const pos = getPos(comp.beat);
                const staffY = pos.yOffset + staffInfo.y;
                const tabY = pos.yOffset + tabYOffset + ((guitar.stringNum - 1) * 12);

                // Draw Ledger Lines for each component
                if (drawStaff) {
                    if (staffInfo.y >= 100) {
                        for (let ly = 100; ly <= staffInfo.y; ly += 10) {
                            svgHtml += `<line x1="${pos.x - 12}" y1="${pos.yOffset + ly}" x2="${pos.x + 12}" y2="${pos.yOffset + ly}" stroke="#0f172a" stroke-width="2"/>`;
                        }
                    } else if (staffInfo.y <= 40) {
                        for (let ly = 40; ly >= staffInfo.y; ly -= 10) {
                            svgHtml += `<line x1="${pos.x - 12}" y1="${pos.yOffset + ly}" x2="${pos.x + 12}" y2="${pos.yOffset + ly}" stroke="#0f172a" stroke-width="2"/>`;
                        }
                    }
                }

                // Handle Tie curves natively across structural breaks
                const isTiedToPrev = (idx === 0 && note.tied) || (idx > 0);
                if (isTiedToPrev && globalLastNoteX !== null) {
                    if (drawStaff) {
                        if (globalLastLineIdx === pos.lineIndex) {
                            const tieDir = staffInfo.y <= 70 ? -1 : 1;
                            const midX = (globalLastNoteX + pos.x) / 2;
                            svgHtml += `<path d="M${globalLastNoteX + 5} ${globalLastNoteY + tieDir * 8} Q${midX} ${globalLastNoteY + tieDir * 14} ${pos.x - 5} ${staffY + tieDir * 8}" fill="none" stroke="#0f172a" stroke-width="1.5"/>`;
                        } else {
                            // Cross-system broken ties
                            const tieDir1 = (globalLastNoteY - (globalLastLineIdx * SYSTEM_HEIGHT)) <= 70 ? -1 : 1;
                            svgHtml += `<path d="M${globalLastNoteX + 5} ${globalLastNoteY + tieDir1 * 8} Q${globalLastNoteX + 20} ${globalLastNoteY + tieDir1 * 14} ${globalLastNoteX + 35} ${globalLastNoteY + tieDir1 * 8}" fill="none" stroke="#0f172a" stroke-width="1.5"/>`;

                            const tieDir2 = staffInfo.y <= 70 ? -1 : 1;
                            svgHtml += `<path d="M${pos.x - 35} ${staffY + tieDir2 * 8} Q${pos.x - 20} ${staffY + tieDir2 * 14} ${pos.x - 5} ${staffY + tieDir2 * 8}" fill="none" stroke="#0f172a" stroke-width="1.5"/>`;
                        }
                    } else {
                        const tieY = pos.yOffset + tabYOffset + 68;
                        if (globalLastLineIdx === pos.lineIndex) {
                            const midX = (globalLastNoteX + pos.x) / 2;
                            svgHtml += `<path d="M${globalLastNoteX + 5} ${tieY} Q${midX} ${tieY + 10} ${pos.x - 5} ${tieY}" fill="none" stroke="#0f172a" stroke-width="1.5"/>`;
                        } else {
                            const tieYPrev = (globalLastLineIdx * SYSTEM_HEIGHT) + tabYOffset + 68;
                            svgHtml += `<path d="M${globalLastNoteX + 5} ${tieYPrev} Q${globalLastNoteX + 20} ${tieYPrev + 10} ${globalLastNoteX + 35} ${tieYPrev}" fill="none" stroke="#0f172a" stroke-width="1.5"/>`;

                            svgHtml += `<path d="M${pos.x - 35} ${tieY} Q${pos.x - 20} ${tieY + 10} ${pos.x - 5} ${tieY}" fill="none" stroke="#0f172a" stroke-width="1.5"/>`;
                        }
                    }
                }

                if (drawStaff) {
                    // Draw Standard Notation Note Head (Hollow for Half/Whole notes)
                    if (comp.dur >= 2 - 0.001) {
                        svgHtml += `<circle cx="${pos.x}" cy="${staffY}" r="5.5" fill="#fff" stroke="#0f172a" stroke-width="2"/>`;
                    } else {
                        svgHtml += `<circle cx="${pos.x}" cy="${staffY}" r="5.5" class="note-head"/>`;
                    }

                    // Draw Stem direction based on staff position
                    if (comp.dur < 4 - 0.001) {
                        const stemDown = comp.isBeamedStaff !== undefined ? comp.stemDownStaff : (staffInfo.y <= 70);
                        const stemX = stemDown ? pos.x - 5 : pos.x + 5;
                        const stemY2 = comp.isBeamedStaff ? comp.stemY2Staff : (stemDown ? staffY + 30 : staffY - 30);
                        svgHtml += `<line x1="${stemX}" y1="${staffY}" x2="${stemX}" y2="${stemY2}" stroke="#0f172a" stroke-width="1.5"/>`;

                        // Draw Flag for Eighth note (0.5), triplet eighth (1/3), etc.
                        if (!comp.isBeamedStaff && comp.dur <= 0.5 + 0.001) {
                            if (stemDown) {
                                svgHtml += `<path d="M${stemX} ${stemY2} Q${stemX + 10} ${stemY2 - 5} ${stemX + 12} ${stemY2 - 20} Q${stemX + 6} ${stemY2 - 10} ${stemX} ${stemY2 - 10}" fill="#0f172a"/>`;
                            } else {
                                svgHtml += `<path d="M${stemX} ${stemY2} Q${stemX + 10} ${stemY2 + 5} ${stemX + 12} ${stemY2 + 20} Q${stemX + 6} ${stemY2 + 10} ${stemX} ${stemY2 + 10}" fill="#0f172a"/>`;
                            }

                            // Draw second Flag for Sixteenth note (0.25) or sixteenth triplet (1/6)
                            if (comp.dur <= 0.25 + 0.001) {
                                const stemY3 = stemDown ? stemY2 - 8 : stemY2 + 8;
                                if (stemDown) {
                                    svgHtml += `<path d="M${stemX} ${stemY3} Q${stemX + 10} ${stemY3 - 5} ${stemX + 12} ${stemY3 - 20} Q${stemX + 6} ${stemY3 - 10} ${stemX} ${stemY3 - 10}" fill="#0f172a"/>`;
                                } else {
                                    svgHtml += `<path d="M${stemX} ${stemY3} Q${stemX + 10} ${stemY3 + 5} ${stemX + 12} ${stemY3 + 20} Q${stemX + 6} ${stemY3 + 10} ${stemX} ${stemY3 + 10}" fill="#0f172a"/>`;
                                }
                            }
                        }
                    }

                    // Draw Dot for Dotted notes
                    if (Math.abs(comp.dur - 3) < 0.01 || Math.abs(comp.dur - 1.5) < 0.01 || Math.abs(comp.dur - 0.75) < 0.01) {
                        svgHtml += `<circle cx="${pos.x + 10}" cy="${staffY}" r="2" class="note-head"/>`;
                    }
                }

                if (drawTabs) {
                    // Draw Guitar Tab Note Intersection Circle Overlay
                    const fretText = isTiedToPrev ? `(${guitar.fret})` : guitar.fret;
                    const bgRadius = isTiedToPrev ? 12 : 8;
                    svgHtml += `<circle cx="${pos.x}" cy="${tabY}" r="${bgRadius}" fill="#fff"/>`;
                    svgHtml += `<text x="${pos.x}" y="${tabY + 4}" class="note-text" fill="#000" style="fill: #000; font-size:12px;">${fretText}</text>`;

                    if (!drawStaff && comp.dur < 4 - 0.001) {
                        const stemY1 = tabY + 10;
                        const stemY2 = comp.isBeamedTab ? comp.stemY2Tab : stemY1 + 25;
                        svgHtml += `<line x1="${pos.x}" y1="${stemY1}" x2="${pos.x}" y2="${stemY2}" stroke="#0f172a" stroke-width="1.5"/>`;

                        if (!comp.isBeamedTab && comp.dur <= 0.5 + 0.001) {
                            svgHtml += `<path d="M${pos.x} ${stemY2} Q${pos.x + 10} ${stemY2 - 5} ${pos.x + 12} ${stemY2 - 20} Q${pos.x + 6} ${stemY2 - 10} ${pos.x} ${stemY2 - 10}" fill="#0f172a"/>`;
                        }

                        if (!comp.isBeamedTab && comp.dur <= 0.25 + 0.001) {
                            const stemY3 = stemY2 - 8;
                            svgHtml += `<path d="M${pos.x} ${stemY3} Q${pos.x + 10} ${stemY3 - 5} ${pos.x + 12} ${stemY3 - 20} Q${pos.x + 6} ${stemY3 - 10} ${pos.x} ${stemY3 - 10}" fill="#0f172a"/>`;
                        }
                    }
                    if (!drawStaff && (Math.abs(comp.dur - 3) < 0.01 || Math.abs(comp.dur - 1.5) < 0.01 || Math.abs(comp.dur - 0.75) < 0.01)) {
                        svgHtml += `<circle cx="${pos.x + 12}" cy="${tabY}" r="2" class="note-head"/>`;
                    }
                }

                globalLastNoteX = pos.x;
                globalLastNoteY = drawStaff ? staffY : tabY;
                globalLastLineIdx = pos.lineIndex;
            });
        });

        // --- RENDER BEAMS ---
        staffBeamGroups.forEach(group => {
            const first = group[0];
            const last = group[group.length - 1];
            const stemX1 = first.stemDownStaff ? first.pos.x - 5 : first.pos.x + 5;
            const stemX2 = last.stemDownStaff ? last.pos.x - 5 : last.pos.x + 5;
            const bY = group.beamY;
            
            svgHtml += `<line x1="${stemX1}" y1="${bY}" x2="${stemX2}" y2="${bY}" stroke="#0f172a" stroke-width="3"/>`;

            let i = 0;
            while(i < group.length) {
                if (group[i].dur <= 0.25 + 0.001) {
                    let j = i;
                    while(j < group.length && group[j].dur <= 0.25 + 0.001) j++;
                    
                    let startX = group[i].stemDownStaff ? group[i].pos.x - 5 : group[i].pos.x + 5;
                    let endX;
                    if (j - i > 1) {
                        endX = group[j-1].stemDownStaff ? group[j-1].pos.x - 5 : group[j-1].pos.x + 5;
                    } else {
                        endX = group[i].stemDownStaff ? group[i].pos.x + 3 : group[i].pos.x - 3;
                        if (i > 0) endX = startX - 8;
                        else endX = startX + 8;
                    }
                    
                    const bY2 = group.stemDownStaff ? bY - 6 : bY + 6;
                    svgHtml += `<line x1="${startX}" y1="${bY2}" x2="${endX}" y2="${bY2}" stroke="#0f172a" stroke-width="3"/>`;
                    i = j;
                } else {
                    i++;
                }
            }
        });

        tabBeamGroups.forEach(group => {
            const first = group[0];
            const last = group[group.length - 1];
            const stemX1 = first.pos.x;
            const stemX2 = last.pos.x;
            const bY = group.beamY;

            svgHtml += `<line x1="${stemX1}" y1="${bY}" x2="${stemX2}" y2="${bY}" stroke="#0f172a" stroke-width="3"/>`;

            let i = 0;
            while(i < group.length) {
                if (group[i].dur <= 0.25 + 0.001) {
                    let j = i;
                    while(j < group.length && group[j].dur <= 0.25 + 0.001) j++;
                    
                    let startX = group[i].pos.x;
                    let endX;
                    if (j - i > 1) {
                        endX = group[j-1].pos.x;
                    } else {
                        if (i > 0) endX = startX - 8;
                        else endX = startX + 8;
                    }
                    
                    const bY2 = bY - 6;
                    svgHtml += `<line x1="${startX}" y1="${bY2}" x2="${endX}" y2="${bY2}" stroke="#0f172a" stroke-width="3"/>`;
                    i = j;
                } else {
                    i++;
                }
            }
        });

        // --- RENDER TUPLET BRACKETS ---
        const isTuplet = (dur) => {
            return Math.abs(dur - 1/3) < 0.01 || Math.abs(dur - 2/3) < 0.01 || Math.abs(dur - 1/6) < 0.01;
        };

        let tupletBrackets = [];
        let currentTuplet = null;

        allComps.forEach(comp => {
            if (isTuplet(comp.dur)) {
                if (!currentTuplet) {
                    currentTuplet = { comps: [], startBeat: comp.beat, sumDur: 0 };
                }
                currentTuplet.comps.push(comp);
                currentTuplet.sumDur += comp.dur;

                if (Math.abs(currentTuplet.sumDur - 1) < 0.01 && !currentTuplet.comps.every(c => Math.abs(c.dur - 2/3) < 0.01)) {
                    tupletBrackets.push(currentTuplet);
                    currentTuplet = null;
                } else if (Math.abs(currentTuplet.sumDur - 2) < 0.01) {
                    tupletBrackets.push(currentTuplet);
                    currentTuplet = null;
                } else if (Math.abs(currentTuplet.sumDur - 0.5) < 0.01 && currentTuplet.comps.every(c => Math.abs(c.dur - 1/6) < 0.01)) {
                    tupletBrackets.push(currentTuplet);
                    currentTuplet = null;
                }
            } else {
                if (currentTuplet) {
                    tupletBrackets.push(currentTuplet);
                    currentTuplet = null;
                }
            }
        });
        if (currentTuplet) tupletBrackets.push(currentTuplet);

        tupletBrackets.forEach(bracket => {
            if (bracket.comps.length < 2) return;

            let smallestDur = Math.min(...bracket.comps.map(c => c.dur));
            let sumDur = bracket.comps.reduce((acc, c) => acc + c.dur, 0);
            let num = 3;
            if (Math.abs(smallestDur - 1/6) < 0.01 && Math.abs(sumDur - 1) < 0.01) num = 6;

            const linesMap = {};
            bracket.comps.forEach(c => {
                const pos = c.pos;
                if (!linesMap[pos.lineIndex]) linesMap[pos.lineIndex] = [];
                linesMap[pos.lineIndex].push({ comp: c, pos });
            });

            Object.keys(linesMap).forEach(lIdx => {
                const lineComps = linesMap[lIdx];
                if (lineComps.length < 2) return;

                const firstPos = lineComps[0].pos;
                const lastPos = lineComps[lineComps.length - 1].pos;

                const startX = firstPos.x;
                const endX = lastPos.x;
                const midX = (startX + endX) / 2;

                if (drawStaff) {
                    let minY = firstPos.yOffset + 40; 
                    lineComps.forEach(lc => {
                        if (!lc.comp.isRest) {
                            let yPos = lc.comp.isBeamedStaff ? lc.comp.stemY2Staff : lc.comp.staffY;
                            if (!lc.comp.stemDownStaff && lc.comp.stemY2Staff) yPos = lc.comp.stemY2Staff; 
                            if (yPos !== undefined && yPos < minY) minY = yPos;
                        }
                    });
                    lineComps.forEach(lc => {
                         if (!lc.comp.isRest && !lc.comp.stemDownStaff && !lc.comp.isBeamedStaff && lc.comp.staffY) {
                             if (lc.comp.staffY - 30 < minY) minY = lc.comp.staffY - 30;
                         }
                    });
                    const y = minY - 15;
                    svgHtml += `<path d="M${startX} ${y+5} L${startX} ${y} L${midX - 8} ${y}" fill="none" stroke="#64748b" stroke-width="1.5"/>`;
                    svgHtml += `<path d="M${midX + 8} ${y} L${endX} ${y} L${endX} ${y+5}" fill="none" stroke="#64748b" stroke-width="1.5"/>`;
                    svgHtml += `<text x="${midX}" y="${y + 4}" font-family="sans-serif" font-size="12" font-weight="bold" fill="#64748b" text-anchor="middle">${num}</text>`;
                } else if (drawTabs) {
                    const y = firstPos.yOffset + tabYOffset - 15;
                    svgHtml += `<path d="M${startX} ${y+5} L${startX} ${y} L${midX - 8} ${y}" fill="none" stroke="#64748b" stroke-width="1.5"/>`;
                    svgHtml += `<path d="M${midX + 8} ${y} L${endX} ${y} L${endX} ${y+5}" fill="none" stroke="#64748b" stroke-width="1.5"/>`;
                    svgHtml += `<text x="${midX}" y="${y + 4}" font-family="sans-serif" font-size="12" font-weight="bold" fill="#64748b" text-anchor="middle">${num}</text>`;
                }
            });
        });

        svgHtml += `<line id="playhead" x1="0" y1="0" x2="0" y2="0" stroke="rgba(239, 68, 68, 0.8)" stroke-width="3" display="none" style="pointer-events: none;" />`;
        svgHtml += `</svg>`;

        // Cache layout bindings to safely interpolate playhead coordinates post-render
        this.layoutMeasures = measures;
        this.layoutSystemHeight = SYSTEM_HEIGHT;
        this.layoutTitleHeight = TITLE_HEIGHT;
        this.layoutTabYOffset = tabYOffset;

        return svgHtml;
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; width: 100%; height: 100%; min-height: 0; }
                .score-wrapper { width: 100%; height: 100%; overflow-y: auto; overflow-x: hidden; padding: 10px; box-sizing: border-box; }
                svg { margin: 0 auto; display: block; user-select: none; -webkit-user-select: none; }
            </style>
            <div class="score-wrapper">
                ${this.generateSVG()}
            </div>
        `;

        const svg = this.shadowRoot.querySelector('svg');
        if (svg) {
            svg.addEventListener('click', (e) => {
                if (!this.layoutMeasures || this.layoutMeasures.length === 0) return;

                const pt = svg.createSVGPoint();
                pt.x = e.clientX;
                pt.y = e.clientY;
                const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());

                let lineIndex = Math.floor((svgP.y - this.layoutTitleHeight) / this.layoutSystemHeight);
                if (lineIndex < 0) lineIndex = 0;

                const measuresInLine = this.layoutMeasures.filter(m => m.lineIndex === lineIndex);
                if (measuresInLine.length === 0) {
                    const lastM = this.layoutMeasures[this.layoutMeasures.length - 1];
                    this.dispatchEvent(new CustomEvent('seek', { detail: { beat: lastM.startBeat } }));
                    return;
                }

                let clickedMeasure = measuresInLine.find(m => svgP.x >= m.startX && svgP.x <= m.endX);
                if (!clickedMeasure) {
                    if (svgP.x < measuresInLine[0].startX) clickedMeasure = measuresInLine[0];
                    else clickedMeasure = measuresInLine[measuresInLine.length - 1];
                }

                let closestBeat = clickedMeasure.startBeat;
                let minDist = Infinity;

                if (clickedMeasure.beats && clickedMeasure.beats.length > 0) {
                    clickedMeasure.beats.forEach(b => {
                        const bx = clickedMeasure.beatPositions[b];
                        const dist = Math.abs(bx - svgP.x);
                        if (dist < minDist) {
                            minDist = dist;
                            closestBeat = b;
                        }
                    });
                }

                this.dispatchEvent(new CustomEvent('seek', { detail: { beat: closestBeat } }));
            });
        }
    }
}

// Register Native Element
customElements.define('notation-viewer', NotationViewer);