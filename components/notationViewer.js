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

        // SVG Dimensions
        const width = 800;
        const height = 260;

        let svgHtml = `
            <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" style="background:#fff; border:1px solid #cbd5e1; border-radius:4px; max-width: 100%; max-height: 100%;">
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

        // --- DRAW STANDARD NOTATION STAFF (5 Lines) ---
        for (let i = 0; i < 5; i++) {
            const y = 50 + (i * 10);
            svgHtml += `<line x1="20" y1="${y}" x2="${width - 20}" y2="${y}" class="staff-line"/>`;
        }
        svgHtml += `<text x="30" y="83" class="clef-text">𝄞</text>`;

        // --- DRAW GUITAR TAB STAFF (6 Lines) ---
        for (let i = 0; i < 6; i++) {
            const y = 150 + (i * 12);
            svgHtml += `<line x1="20" y1="${y}" x2="${width - 20}" y2="${y}" class="staff-line"/>`;
        }
        svgHtml += `<text x="30" y="172" class="tab-text">T</text>`;
        svgHtml += `<text x="30" y="190" class="tab-text">A</text>`;
        svgHtml += `<text x="30" y="208" class="tab-text">B</text>`;

        // System Boundary Bar Lines
        svgHtml += `<line x1="20" y1="50" x2="20" y2="210" class="bar-line"/>`;
        svgHtml += `<line x1="${width - 20}" y1="50" x2="${width - 20}" y2="210" class="bar-line"/>`;

        // --- DRAW KEY SIGNATURE ---
        const keySig = this.getKeySignature(key);
        let kx = 55;
        keySig.forEach(acc => {
            svgHtml += `<text x="${kx}" y="${acc.y + 6}" class="accidental-text">${acc.symbol}</text>`;
            kx += 12;
        });
        
        // --- DRAW TIME SIGNATURE ---
        let tsX = Math.max(70, kx + 15);
        const tsNum = Array.isArray(timeSignature) ? timeSignature[0] : 4;
        const tsDen = Array.isArray(timeSignature) ? timeSignature[1] : 4;
        svgHtml += `<text x="${tsX}" y="68" class="time-sig-text">${tsNum}</text>`;
        svgHtml += `<text x="${tsX}" y="88" class="time-sig-text">${tsDen}</text>`;

        const startX = tsX + 30;

        // --- RENDER REVEALED CHORDS ---
        let chordX = startX;
        const rootNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        visibleChords.forEach((chord) => {
            const name = rootNames[chord.root % 12] + chord.type;
            svgHtml += `<text x="${chordX}" y="30" class="chord-label">${name}</text>`;
            chordX += 160;
        });

        // --- RENDER REVEALED MELODY NOTES ---
        let noteX = startX;
        
        const barDuration = tsNum * (4 / tsDen);
        let currentBeat = anacrouse > 0 ? (barDuration - anacrouse) : 0;

        visibleNotes.forEach((note) => {
            if (note === 'BAR' || note.type === 'BAR') {
                let barX = noteX - 35;
                svgHtml += `<line x1="${barX}" y1="50" x2="${barX}" y2="210" class="bar-line"/>`;
                currentBeat = 0;
                return;
            }

            const staffInfo = this.midiToStaffInfo(note.pitch, key);
            const staffY = staffInfo.y;
            const guitar = this.midiToGuitar(note.pitch);
            const tabY = 150 + ((guitar.stringNum - 1) * 12);

            // Draw Ledger Lines for standard notation
            if (staffY >= 100) {
                for (let ly = 100; ly <= staffY; ly += 10) {
                    svgHtml += `<line x1="${noteX - 8}" y1="${ly}" x2="${noteX + 8}" y2="${ly}" stroke="#0f172a" stroke-width="1.5"/>`;
                }
            } else if (staffY <= 40) {
                for (let ly = 40; ly >= staffY; ly -= 10) {
                    svgHtml += `<line x1="${noteX - 8}" y1="${ly}" x2="${noteX + 8}" y2="${ly}" stroke="#0f172a" stroke-width="1.5"/>`;
                }
            }

            // Draw Accidental
            if (staffInfo.accidental) {
                const accSymbol = staffInfo.accidental === 'n' ? '♮' : (staffInfo.accidental === 'b' ? '♭' : '♯');
                svgHtml += `<text x="${noteX - 16}" y="${staffY + 6}" class="accidental-text">${accSymbol}</text>`;
            }

            // Draw Standard Notation Note Head & Stem
            svgHtml += `<circle cx="${noteX}" cy="${staffY}" r="5" class="note-head"/>`;
            svgHtml += `<line x1="${noteX + 5}" y1="${staffY}" x2="${noteX + 5}" y2="${staffY - 25}" stroke="#0f172a" stroke-width="1.5"/>`;

            // Draw Guitar Tab Note Intersection Circle Overlay
            svgHtml += `<circle cx="${noteX}" cy="${tabY}" r="7" fill="#fff"/>`;
            svgHtml += `<text x="${noteX}" y="${tabY + 4}" class="note-text" fill="#000" style="fill: #000; font-size:12px;">${guitar.fret}</text>`;

            noteX += 70; // Step right
            currentBeat += note.duration;

            // Draw automatic bar line if we filled the measure
            if (currentBeat >= barDuration - 0.001) {
                let barX = noteX - 35;
                svgHtml += `<line x1="${barX}" y1="50" x2="${barX}" y2="210" class="bar-line"/>`;
                currentBeat -= barDuration;
            }
        });

        svgHtml += `</svg>`;
        return svgHtml;
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; width: 100%; height: 100%; }
                .score-wrapper { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
            </style>
            <div class="score-wrapper">
                ${this.generateSVG()}
            </div>
        `;
    }
}

// Register Native Element
customElements.define('notation-viewer', NotationViewer);