/**
 * Custom Web Component: <chord-viewer>
 * Renders a clean, grid-based Jazz Chord Chart with a proportional playhead fill.
 */
export class ChordViewer extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.state = {
            title: "",
            key: "",
            melody: [],
            chords: [],
            revealMelody: 'empty',
            revealChords: true,
            timeSignature: [4, 4],
            anacrouse: 0,
            displayMode: 'both',
            visualTranspose: 0,
            zoom: 1.0
        };
        this.measures = [];
    }

    static get observedAttributes() {
        return [];
    }

    connectedCallback() {
        this.renderSkeleton();
        this.renderChart();
    }

    updateData(title, key, melody, chords, revealMelody = 'empty', revealChords = true, timeSignature = [4, 4], anacrouse = 0, displayMode = 'both', visualTranspose = 0) {
        const currentZoom = this.state.zoom || 1.0;
        this.state = { title, key, melody, chords, revealMelody, revealChords: true, timeSignature, anacrouse, displayMode, visualTranspose, zoom: currentZoom };
        this.renderChart();
    }

    setPlayhead(beat) {
        // Remove active states and reset fills if beat is null or out of range
        if (beat === null || !this.measures || this.measures.length === 0) {
            const cells = this.shadowRoot.querySelectorAll('.measure-cell');
            cells.forEach(cell => {
                cell.classList.remove('active');
                const fill = cell.querySelector('.playhead-fill');
                if (fill) fill.style.width = '0%';
            });
            const pickupElement = this.shadowRoot.getElementById('anacrouse-cell');
            if (pickupElement) pickupElement.classList.remove('active');
            return;
        }

        const tsNum = Array.isArray(this.state.timeSignature) ? this.state.timeSignature[0] : 4;
        const tsDen = Array.isArray(this.state.timeSignature) ? this.state.timeSignature[1] : 4;
        const barDuration = tsNum * (4 / tsDen);

        this.measures.forEach((measure) => {
            if (measure.isAnacrouse) {
                const pickupElement = this.shadowRoot.getElementById('anacrouse-cell');
                if (pickupElement) {
                    if (beat >= measure.startBeat - 0.001 && beat < measure.endBeat - 0.001) {
                        pickupElement.classList.add('active');
                    } else {
                        pickupElement.classList.remove('active');
                    }
                }
                return;
            }

            const cell = this.shadowRoot.getElementById(`measure-${measure.index}`);
            if (!cell) return;

            const fill = cell.querySelector('.playhead-fill');

            if (beat >= measure.startBeat - 0.001 && beat < measure.endBeat - 0.001) {
                cell.classList.add('active');
                const progress = ((beat - measure.startBeat) / barDuration) * 100;
                if (fill) fill.style.width = `${Math.min(100, Math.max(0, progress))}%`;

                cell.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                cell.classList.remove('active');
                if (fill) fill.style.width = beat >= measure.endBeat ? '100%' : '0%';
            }
        });
    }

    getChordRoots() {
        const transposedKey = this.state.key || "C";
        const _chordKeyRoot = transposedKey.replace(/m.*$/, '');
        const _isMinorKey = transposedKey.toLowerCase().replace(_chordKeyRoot.toLowerCase(), '').includes('m');
        const _pcMap = { 'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11 };
        const _keyPC = _pcMap[_chordKeyRoot] ?? 0;
        const _flatMajorPCs = new Set([5, 10, 3, 8, 1, 6]);
        const _flatMinorPCs = new Set([2, 7, 0, 5, 10, 3]);
        const useFlats = _isMinorKey ? _flatMinorPCs.has(_keyPC) : _flatMajorPCs.has(_keyPC);

        const sharpRoots = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const flatRoots = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
        return useFlats ? flatRoots : sharpRoots;
    }

    renderSkeleton() {
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; width: 100%; height: 100%; min-height: 0; position: relative; }
                .score-wrapper { width: 100%; height: 100%; overflow: auto; padding: 20px; box-sizing: border-box; font-family: 'Kalam', sans-serif, system-ui; }
                .title-header { text-align: center; font-size: 32px; font-weight: bold; margin-bottom: 5px; color: var(--text-main); }

                .anacrouse-container { text-align: left; margin-bottom: 15px; min-height: 30px; }
                .anacrouse-text { display: inline-block; font-size: 16px; font-style: italic; color: var(--text-main); padding: 4px 12px; border-radius: 4px; border: 1px dashed transparent; transition: all 0.2s ease; }
                .anacrouse-text.active { border-color: var(--primary); }
                .anacrouse-chords { font-family: 'Kalam', sans-serif; font-size: 20px; font-weight: bold; color: var(--text-main); margin-left: 6px; }
                .anacrouse-text.active .anacrouse-chords { color: var(--primary-hover); }

                /* 4-column layout standard for jazz chord grids */
                .chord-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0px; margin: 0 auto; max-width: 950px; }

                .measure-cell { position: relative; border: 2px solid; min-height: 90px; display: flex; align-items: center; justify-content: space-around; padding: 5px; box-sizing: border-box; overflow: hidden; transition: box-shadow 0.2s ease; }
                .measure-cell.active { border-color: var(--primary); box-shadow: 0 0 8px rgba(239, 68, 68, 0.3); }
                .measure-number { position: absolute; top: 4px; left: 6px; font-size: 11px; font-weight: bold; color: #94a3b8; font-family: sans-serif; z-index: 2; }

                /* Playhead container filling from left to right */
                .playhead-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0%; opacity: 20%; background: var(--primary); z-index: 1; pointer-events: none; transition: width 0.05s linear; }

                .chords-container { display: flex; width: 100%; justify-content: space-around; align-items: center; z-index: 2; position: relative; }
                .chord-item { font-size: 24px; font-weight: bold; color: var(--text-main); text-shadow: 1px 1px 0px var(--text-muted); }

                .zoom-controls { position: absolute; bottom: 20px; right: 20px; background: #1e293b; padding: 8px 12px; border: 1px solid #0f172a; border-radius: 8px; box-shadow: 0 8px 12px #0f172a; display: flex; align-items: center; gap: 10px; z-index: 10; font-family: sans-serif; font-size: 13px; color: #f8fafc; }
                .zoom-controls input[type="range"] { cursor: pointer; width: 125px; margin: 0; }
            </style>
            <div class="zoom-controls">
                <label id="reset-zoom-btn" style="cursor: pointer;" title="Reset to 100%">Zoom</label>
                <input type="range" id="zoom-slider" min="0.5" max="1.2" step="0.05" value="${this.state.zoom || 1.0}">
                <span id="zoom-display">${Math.round((this.state.zoom || 1.0) * 100)}%</span>
            </div>
            <div class="score-wrapper">
                <div class="title-header" id="title-display"></div>
                <div class="anacrouse-container" id="anacrouse-display"></div>
                <div class="chord-grid" id="grid-display"></div>
            </div>
        `;

        const slider = this.shadowRoot.getElementById('zoom-slider');
        const display = this.shadowRoot.getElementById('zoom-display');
        slider.addEventListener('input', (e) => {
            this.state.zoom = parseFloat(e.target.value);
            display.textContent = Math.round(this.state.zoom * 100) + '%';
            this.shadowRoot.getElementById('grid-display').style.transform = `scale(${this.state.zoom})`;
            this.shadowRoot.getElementById('grid-display').style.transformOrigin = 'top center';
        });

        this.shadowRoot.getElementById('reset-zoom-btn').addEventListener('click', () => {
            this.state.zoom = 1.0;
            slider.value = 1.0;
            display.textContent = '100%';
            this.shadowRoot.getElementById('grid-display').style.transform = `scale(1.0)`;
        });
    }

    renderChart() {
        if (!this.shadowRoot.getElementById('grid-display')) {
            this.renderSkeleton();
        }

        const { title, key, chords, revealChords, timeSignature, anacrouse } = this.state;

        this.shadowRoot.getElementById('title-display').textContent = title;

        const anacrouseContainer = this.shadowRoot.getElementById('anacrouse-display');
        anacrouseContainer.innerHTML = '';

        const gridContainer = this.shadowRoot.getElementById('grid-display');
        gridContainer.innerHTML = '';

        const tsNum = Array.isArray(timeSignature) ? timeSignature[0] : 4;
        const tsDen = Array.isArray(timeSignature) ? timeSignature[1] : 4;
        const barDuration = tsNum * (4 / tsDen);

        let maxBeat = 0;
        chords.forEach(c => {
            if (c.isRepeat) return;
            let b = c.visualBeat !== undefined ? c.visualBeat : c.beat;
            if (b !== undefined && c.duration) maxBeat = Math.max(maxBeat, b + c.duration);
        });

        // Calculate only regular full measures following the anacrouse threshold
        const regularMeasures = maxBeat > anacrouse ? Math.ceil((maxBeat - anacrouse) / barDuration) : 0;

        this.measures = [];
        const chordRoots = this.getChordRoots();

        // Separate and render the Anacrouse as inline small text banner
        if (anacrouse > 0) {
            const pickupChords = chords.filter(c => {
                if (c.isRepeat) return false;
                const vBeat = c.visualBeat !== undefined ? c.visualBeat : c.beat;
                return vBeat < anacrouse - 0.001;
            });
            pickupChords.sort((a, b) => (a.visualBeat ?? a.beat) - (b.visualBeat ?? b.beat));

            // Keep tracking structure intact for playhead highlighting
            this.measures.push({ index: -1, startBeat: 0, endBeat: anacrouse, isAnacrouse: true });

            const chordStr = pickupChords.length > 0 
                ? pickupChords.map(chord => {
                    let displayRoot = chord.root;
                    displayRoot = ((displayRoot % 12) + 12) % 12;
                    return chordRoots[displayRoot] + chord.type;
                }).join('  ')
                : 'N.C.'; 

            const textBlock = document.createElement('div');
            textBlock.className = 'anacrouse-text';
            textBlock.id = 'anacrouse-cell';
            // Dynamically show the exact number of beats in the pickup heading
            textBlock.innerHTML = `Pickup (${anacrouse} beat${anacrouse > 1 ? 's' : ''}): <span class="anacrouse-chords">${chordStr}</span>`;

            textBlock.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('seek', { detail: { beat: 0 }, bubbles: true, composed: true }));
            });

            anacrouseContainer.appendChild(textBlock);
        }

        // Loop exclusively through the structure grid measures
        for (let m = 0; m < regularMeasures; m++) {
            let startBeat = anacrouse + (m * barDuration);
            let endBeat = anacrouse + ((m + 1) * barDuration);

            this.measures.push({ index: m, startBeat, endBeat });

            const measureChords = chords.filter(c => {
                if (c.isRepeat) return false;
                const vBeat = c.visualBeat !== undefined ? c.visualBeat : c.beat;
                return (vBeat >= startBeat - 0.001 && vBeat < endBeat - 0.001);
            });
            measureChords.sort((a, b) => (a.visualBeat ?? a.beat) - (b.visualBeat ?? b.beat));

            const cell = document.createElement('div');
            cell.className = 'measure-cell';
            cell.id = `measure-${m}`;

            cell.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('seek', { detail: { beat: startBeat }, bubbles: true, composed: true }));
            });

            const measureNum = document.createElement('div');
            measureNum.className = 'measure-number';
            measureNum.textContent = m + 1 + (!!anacrouse);
            cell.appendChild(measureNum);

            const playheadFill = document.createElement('div');
            playheadFill.className = 'playhead-fill';
            cell.appendChild(playheadFill);

            const chordsContainer = document.createElement('div');
            chordsContainer.className = 'chords-container';

            if (measureChords.length > 0) {
                measureChords.forEach(chord => {
                    const chordItem = document.createElement('div');
                    chordItem.className = 'chord-item';

                    let displayRoot = chord.root;
                    displayRoot = ((displayRoot % 12) + 12) % 12;
                    chordItem.textContent = chordRoots[displayRoot] + chord.type;

                    chordsContainer.appendChild(chordItem);
                });
            } else {
                const slashItem = document.createElement('div');
                slashItem.className = 'chord-item';
                slashItem.style.color = '#cbd5e1';
                slashItem.textContent = '%';
                chordsContainer.appendChild(slashItem);
            }

            cell.appendChild(chordsContainer);
            gridContainer.appendChild(cell);
        }

        gridContainer.style.transform = `scale(${this.state.zoom})`;
        gridContainer.style.transformOrigin = 'top center';
    }
}

customElements.define('chord-viewer', ChordViewer);