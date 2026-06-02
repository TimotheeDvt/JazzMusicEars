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
            anacrouse: 0
        };
    }

    static get observedAttributes() {
        return [];
    }

    connectedCallback() {
        this.render();
    }

    updateData(title, key, melody, chords, revealMelody = 'empty', revealChords = false, timeSignature = [4, 4], anacrouse = 0) {
        this.state = { title, key, melody, chords, revealMelody, revealChords, timeSignature, anacrouse };
        this.render();
    }

    // Helper map to convert absolute MIDI numbers into standard string/fret combinations
    // Simple structural mapping for standard EADGBE guitar tuning
    midiToGuitar(midi) {
        const strings = [64, 59, 55, 50, 45, 40]; // E, B, G, D, A, E positions
        for (let sIdx = 0; sIdx < strings.length; sIdx++) {
            const rootPitch = strings[sIdx];
            if (midi >= rootPitch && midi <= rootPitch + 15) {
                return { stringNum: sIdx + 1, fret: midi - rootPitch };
            }
        }
        return { stringNum: 1, fret: 0 }; // Fallback
    }

    // Get standard key signature properties based on scale name
    getKeySignature(keyName) {
        const sharps = [50, 65, 45, 60, 75, 55, 70]; // F, C, G, D, A, E, B
        const flats = [70, 55, 75, 60, 80, 65, 85];  // B, E, A, D, G, C, F

        const keyMap = {
            "C": 0, "Am": 0, "G": 1, "Em": 1, "D": 2, "Bm": 2,
            "A": 3, "F#m": 3, "E": 4, "C#m": 4, "B": 5, "G#m": 5,
            "F#": 6, "F": -1, "Dm": -1, "A#": -2, "Gm": -2,
            "D#": -3, "Cm": -3, "G#": -4, "Fm": -4, "C#": -5,
            "A#m": -5, "D#m": -6
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
        const flatKeys = ["F", "A#", "D#", "G#", "C#", "Dm", "Gm", "Cm", "Fm", "A#m", "D#m"];
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
            "A": 3, "F#m": 3, "E": 4, "C#m": 4, "B": 5, "G#m": 5, "F#": 6,
            "F": -1, "Dm": -1, "A#": -2, "Gm": -2, "D#": -3, "Cm": -3,
            "G#": -4, "Fm": -4, "C#": -5, "A#m": -5, "D#m": -6
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
        const { melody, chords, revealMelody, revealChords, key, timeSignature, anacrouse } = this.state;

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

        const keySig = this.getKeySignature(key);
        let kx = 55;
        keySig.forEach(() => kx += 12);

        const line0StartX = Math.max(70, kx + 15) + 30; // Accommodate time signature space
        const lineNStartX = kx + 20;

        const SYSTEM_HEIGHT = 260;
        const WIDTH = 950;

        // Calculate maximum required beats to determine total measures needed
        let maxBeat = 0;
        visibleNotes.forEach(n => { if (n !== 'BAR' && n.beat !== undefined) maxBeat = Math.max(maxBeat, n.beat + n.duration); });
        visibleChords.forEach(c => { if (c.beat !== undefined) maxBeat = Math.max(maxBeat, c.beat + c.duration); });

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
        visibleNotes.forEach(note => {
            if (note === 'BAR' || note.type === 'BAR' || note.beat === undefined) return;
            let currentNoteBeat = note.beat;
            let remaining = note.duration;
            let comps = [];
            [4, 3, 2, 1.5, 1, 0.5].forEach(val => {
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
        visibleChords.forEach(c => {
            if (c.beat !== undefined) allEventBeats.add(c.beat);
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
        const height = totalLines * SYSTEM_HEIGHT;

        let svgHtml = `
            <svg viewBox="0 0 ${WIDTH} ${height}" width="100%" xmlns="http://www.w3.org/2000/svg" style="background:#fff; border:1px solid #cbd5e1; border-radius:4px; display: block;">
                <style>
                    .staff-line { stroke: #64748b; stroke-width: 1; }
                    .clef-text { font-family: serif; font-size: 42px; font-weight: bold; fill: #1e293b; }
                    .tab-text { font-family: 'Arial Concrete', sans-serif; font-size: 20px; font-weight: 900; fill: #64748b; }
                    .note-head { fill: #0f172a; }
                    .note-text { font-family: sans-serif; font-size: 11px; font-weight: bold; fill: #fff; text-anchor: middle; }
                    .accidental-text { font-family: serif; font-size: 20px; font-weight: bold; fill: #0f172a; }
                    .chord-label { font-family: sans-serif; font-size: 16px; font-weight: bold; fill: #4f46e5; text-anchor: middle; }
                    .time-sig-text { font-family: serif; font-size: 26px; font-weight: bold; fill: #1e293b; text-anchor: middle; }
                    .bar-line { stroke: #334155; stroke-width: 2; }
                </style>
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
                yOffset: targetMeasure.lineIndex * SYSTEM_HEIGHT
            };
        };

        // --- DRAW MUSICAL SYSTEMS ---
        for (let lineIndex = 0; lineIndex < totalLines; lineIndex++) {
            const yOffset = lineIndex * SYSTEM_HEIGHT;

            // Draw Standard Notation Staff
            for (let i = 0; i < 5; i++) {
                const y = yOffset + 50 + (i * 10);
                svgHtml += `<line x1="20" y1="${y}" x2="${WIDTH - 20}" y2="${y}" class="staff-line"/>`;
            }
            svgHtml += `<text x="30" y="${yOffset + 83}" class="clef-text">𝄞</text>`;

            // Draw Guitar Tab Staff
            for (let i = 0; i < 6; i++) {
                const y = yOffset + 150 + (i * 12);
                svgHtml += `<line x1="20" y1="${y}" x2="${WIDTH - 20}" y2="${y}" class="staff-line"/>`;
            }
            svgHtml += `<text x="30" y="${yOffset + 172}" class="tab-text">T</text>`;
            svgHtml += `<text x="30" y="${yOffset + 190}" class="tab-text">A</text>`;
            svgHtml += `<text x="30" y="${yOffset + 208}" class="tab-text">B</text>`;

            // Draw Boundary Barlines
            svgHtml += `<line x1="20" y1="${yOffset + 50}" x2="20" y2="${yOffset + 210}" class="bar-line"/>`;
            svgHtml += `<line x1="${WIDTH - 20}" y1="${yOffset + 50}" x2="${WIDTH - 20}" y2="${yOffset + 210}" class="bar-line"/>`;

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
        }

        // --- DRAW MEASURE BARLINES ---
        for (let i = 0; i < measures.length - 1; i++) {
            const currentMeasure = measures[i];
            const nextMeasure = measures[i + 1];
            if (currentMeasure.lineIndex === nextMeasure.lineIndex) {
                const x = nextMeasure.startX;
                const yOffset = currentMeasure.lineIndex * SYSTEM_HEIGHT;
                svgHtml += `<line x1="${x}" y1="${yOffset + 50}" x2="${x}" y2="${yOffset + 210}" class="bar-line"/>`;
            }
        }

        // --- RENDER REVEALED CHORDS ---
        const rootNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        visibleChords.forEach((chord) => {
            if (chord.beat === undefined) return;
            const pos = getPos(chord.beat);
            const name = rootNames[chord.root % 12] + chord.type;
            svgHtml += `<text x="${pos.x}" y="${pos.yOffset + 30}" class="chord-label">${name}</text>`;
        });

        // --- RENDER REVEALED MELODY NOTES ---
        let globalLastNoteX = null;
        let globalLastNoteY = null;
        let globalLastLineIdx = null;

        visibleNotes.forEach((note) => {
            if (note === 'BAR' || note.type === 'BAR' || note.beat === undefined) return;

            const staffInfo = this.midiToStaffInfo(note.pitch, key);
            const guitar = this.midiToGuitar(note.pitch);
            const noteStartPos = getPos(note.beat);

            // Draw Accidental (Once per actual note)
            if (staffInfo.accidental) {
                const accSymbol = staffInfo.accidental === 'n' ? '♮' : (staffInfo.accidental === 'b' ? '♭' : '♯');
                svgHtml += `<text x="${noteStartPos.x - 20}" y="${noteStartPos.yOffset + staffInfo.y + 6}" class="accidental-text">${accSymbol}</text>`;
            }

            // Decompose duration into standard visual components (e.g., 5 becomes a Whole Note tied to a Quarter Note)
            note.comps.forEach((comp, idx) => {
                const pos = getPos(comp.beat);
                const staffY = pos.yOffset + staffInfo.y;
                const tabY = pos.yOffset + 150 + ((guitar.stringNum - 1) * 12);

                // Draw Ledger Lines for each component
                if (staffInfo.y >= 100) {
                    for (let ly = 100; ly <= staffInfo.y; ly += 10) {
                        svgHtml += `<line x1="${pos.x - 12}" y1="${pos.yOffset + ly}" x2="${pos.x + 12}" y2="${pos.yOffset + ly}" stroke="#0f172a" stroke-width="2"/>`;
                    }
                } else if (staffInfo.y <= 40) {
                    for (let ly = 40; ly >= staffInfo.y; ly -= 10) {
                        svgHtml += `<line x1="${pos.x - 12}" y1="${pos.yOffset + ly}" x2="${pos.x + 12}" y2="${pos.yOffset + ly}" stroke="#0f172a" stroke-width="2"/>`;
                    }
                }

                // Handle Tie curves natively across structural breaks
                const isTiedToPrev = (idx === 0 && note.tied) || (idx > 0);
                if (isTiedToPrev && globalLastNoteX !== null) {
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
                }

                // Draw Standard Notation Note Head (Hollow for Half/Whole notes)
                if (comp.dur >= 2) {
                    svgHtml += `<circle cx="${pos.x}" cy="${staffY}" r="5.5" fill="#fff" stroke="#0f172a" stroke-width="2"/>`;
                } else {
                    svgHtml += `<circle cx="${pos.x}" cy="${staffY}" r="5.5" class="note-head"/>`;
                }

                // Draw Stem direction based on staff position
                if (comp.dur < 4) {
                    const stemDown = staffInfo.y <= 70;
                    const stemX = stemDown ? pos.x - 5 : pos.x + 5;
                    const stemY2 = stemDown ? staffY + 30 : staffY - 30;
                    svgHtml += `<line x1="${stemX}" y1="${staffY}" x2="${stemX}" y2="${stemY2}" stroke="#0f172a" stroke-width="1.5"/>`;

                    // Draw Flag for Eighth note (0.5)
                    if (comp.dur === 0.5) {
                        if (stemDown) {
                            svgHtml += `<path d="M${stemX} ${stemY2} Q${stemX + 10} ${stemY2 - 5} ${stemX + 12} ${stemY2 - 20} Q${stemX + 6} ${stemY2 - 10} ${stemX} ${stemY2 - 10}" fill="#0f172a"/>`;
                        } else {
                            svgHtml += `<path d="M${stemX} ${stemY2} Q${stemX + 10} ${stemY2 + 5} ${stemX + 12} ${stemY2 + 20} Q${stemX + 6} ${stemY2 + 10} ${stemX} ${stemY2 + 10}" fill="#0f172a"/>`;
                        }
                    }
                }

                // Draw Dot for Dotted notes
                if (comp.dur === 3 || comp.dur === 1.5) {
                    svgHtml += `<circle cx="${pos.x + 10}" cy="${staffY}" r="2" class="note-head"/>`;
                }

                // Draw Guitar Tab Note Intersection Circle Overlay
                svgHtml += `<circle cx="${pos.x}" cy="${tabY}" r="8" fill="#fff"/>`;
                svgHtml += `<text x="${pos.x}" y="${tabY + 4}" class="note-text" fill="#000" style="fill: #000; font-size:12px;">${guitar.fret}</text>`;

                globalLastNoteX = pos.x;
                globalLastNoteY = staffY;
                globalLastLineIdx = pos.lineIndex;
            });
        });

        svgHtml += `</svg>`;
        return svgHtml;
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; width: 100%; height: 100%; min-height: 0; }
                .score-wrapper { width: 100%; height: 100%; overflow-y: auto; overflow-x: hidden; padding: 10px; box-sizing: border-box; }
                svg { margin: 0 auto; display: block; }
            </style>
            <div class="score-wrapper">
                ${this.generateSVG()}
            </div>
        `;
    }
}

// Register Native Element
customElements.define('notation-viewer', NotationViewer);