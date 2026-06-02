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
            revealChords: false
        };
    }

    static get observedAttributes() {
        return [];
    }

    connectedCallback() {
        this.render();
    }

    updateData(title, key, melody, chords, revealMelody = 'empty', revealChords = false) {
        this.state = { title, key, melody, chords, revealMelody, revealChords };
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

    // Convert MIDI pitch to programmatic vertical Y position offset on standard Treble Clef staff line
    midiToStaffY(midi) {
        // Center line is B4 (MIDI 71)
        const semitoneToStaffStep = {
            59: 5,  // B3
            60: 4,  // C4
            62: 3,  // D4
            64: 2,  // E4
            65: 1,  // F4
            67: 0,  // G4
            69: -1, // A4
            71: -2, // B4
            72: -3, // C5
            74: -4, // D5
            76: -5, // E5
            77: -6, // F5
            79: -7  // G5
        };
        
        // Find closest matching baseline step
        const matchedStep = semitoneToStaffStep[midi] !== undefined ? semitoneToStaffStep[midi] : 0;
        return 70 + (matchedStep * 8); 
    }

    generateSVG() {
        const { melody, chords, revealMelody, revealChords } = this.state;
        
        let visibleNotes = [];
        let visibleChords = [];

        if (revealMelody === 'first' && melody.length > 0) {
            visibleNotes = [melody[0]];
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
            <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="background:#fff; border:1px solid #cbd5e1; border-radius:4px;">
                <style>
                    .staff-line { stroke: #64748b; stroke-width: 1; }
                    .clef-text { font-family: serif; font-size: 42px; font-weight: bold; fill: #1e293b; }
                    .tab-text { font-family: 'Arial Concrete', sans-serif; font-size: 20px; font-weight: 900; fill: #64748b; }
                    .note-head { fill: #0f172a; }
                    .note-text { font-family: sans-serif; font-size: 11px; font-weight: bold; fill: #fff; text-anchor: middle; }
                    .chord-label { font-family: sans-serif; font-size: 16px; font-weight: bold; fill: #4f46e5; text-anchor: middle; }
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

        // --- RENDER REVEALED CHORDS ---
        let chordX = 100;
        visibleChords.forEach((chord) => {
            const rootNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
            const name = rootNames[chord.root % 12] + chord.type;
            svgHtml += `<text x="${chordX}" y="30" class="chord-label">${name}</text>`;
            chordX += 160;
        });

        // --- RENDER REVEALED MELODY NOTES ---
        let noteX = 100;
        visibleNotes.forEach((note) => {
            const staffY = this.midiToStaffY(note.pitch);
            const guitar = this.midiToGuitar(note.pitch);
            const tabY = 150 + ((guitar.stringNum - 1) * 12);

            // Draw Standard Notation Note Head & Stem
            svgHtml += `<circle cx="${noteX}" cy="${staffY}" r="5" class="note-head"/>`;
            svgHtml += `<line x1="${noteX + 5}" y1="${staffY}" x2="${noteX + 5}" y2="${staffY - 25}" stroke="#0f172a" stroke-width="1.5"/>`;

            // Draw Guitar Tab Note Intersection Circle Overlay
            svgHtml += `<circle cx="${noteX}" cy="${tabY}" r="7" fill="#fff"/>`;
            svgHtml += `<text x="${noteX}" y="${tabY + 4}" class="note-text" fill="#000" style="fill: #000; font-size:12px;">${guitar.fret}</text>`;

            noteX += 70; // Step right
        });

        svgHtml += `</svg>`;
        return svgHtml;
    }

    render() {
        this.shadowRoot.innerHTML = `
            <div class="score-wrapper">
                ${this.generateSVG()}
            </div>
        `;
    }
}

// Register Native Element
customElements.define('notation-viewer', NotationViewer);