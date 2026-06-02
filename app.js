import { jazzStandards, KEYS } from './data/tunes.js';
import { audioEngine } from './services/audioEngine.js';
import { Scheduler } from './services/scheduler.js';
import './components/notationViewer.js';

class AppController {
    constructor() {
        this.scheduler = new Scheduler(jazzStandards);

        // App State
        this.currentOriginalTune = null;
        this.currentTransposedTune = null;
        this.currentTargetKeyIdx = 0;
        this.selectedTuneIds = [...jazzStandards]; // All selected by default
        this.poolSize = 10;
        this.revealMelodyState = 'empty';
        this.revealChordsState = false;

        // Cache DOM Elements
        this.tuneTitle = document.getElementById('tune-title');
        this.tuneKey = document.getElementById('tune-key');
        this.keyDownBtn = document.getElementById('key-down-btn');
        this.keyUpBtn = document.getElementById('key-up-btn');
        this.notationDisplay = document.getElementById('notation-display');
        this.poolSizeInput = document.getElementById('pool-size');

        // Buttons
        this.playMelodyBtn = document.getElementById('play-melody-btn');
        this.toggleChordsBtn = document.getElementById('toggle-chords-btn');
        this.revealFirstBtn = document.getElementById('reveal-first-btn');
        this.revealMelodyBtn = document.getElementById('reveal-melody-btn');
        this.revealChordsBtn = document.getElementById('reveal-chords-btn');
        this.nextTuneBtn = document.getElementById('next-tune-btn');
        this.evaluationCard = document.getElementById('evaluation-card');
        this.manageTunesBtn = document.getElementById('manage-tunes-btn');

        // Modal elements
        this.tuneModal = document.getElementById('tune-modal');
        this.tuneCheckboxList = document.getElementById('tune-checkbox-list');
        this.closeModalBtn = document.getElementById('close-modal-btn');

        // Youtube Link Container
        this.ytContainer = document.getElementById('youtube-link-container');
        this.ytLink = document.getElementById('youtube-link');

        // Settings panel elements
        this.exportBtn = document.getElementById('export-btn');
        this.importBtn = document.getElementById('import-btn');
        this.fileInput = document.getElementById('import-file');

        this.initEventListeners();
        this.initModalList();
        this.loadNextTune();
    }

    initEventListeners() {
        this.playMelodyBtn.addEventListener('click', () => {
            if (this.currentTransposedTune) {
                audioEngine.playMelody(this.currentTransposedTune.melody);
            }
        });

        this.toggleChordsBtn.addEventListener('click', () => {
            if (!this.currentTransposedTune) return;

            if (audioEngine.isPlayingChords) {
                audioEngine.stopChordsLoop();
                this.toggleChordsBtn.textContent = "Loop Chords: OFF";
                this.toggleChordsBtn.classList.remove('primary');
            } else {
                audioEngine.startChordsLoop(this.currentTransposedTune.chords);
                this.toggleChordsBtn.textContent = "Loop Chords: ON 🔄";
                this.toggleChordsBtn.classList.add('primary');
            }
        });

        this.revealFirstBtn.addEventListener('click', () => {
            this.revealMelodyState = 'first';
            this.updateDisplay();
        });

        this.revealMelodyBtn.addEventListener('click', () => {
            this.revealMelodyState = 'full';
            this.updateDisplay();
        });

        this.revealChordsBtn.addEventListener('click', () => {
            this.revealChordsState = true;
            this.updateDisplay();
        });

        // Handle Evaluation Confidence Clicks
        document.querySelectorAll('.conf-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.conf-btn').forEach(b => b.classList.remove('selected'));
                e.target.classList.add('selected');

                const score = e.target.dataset.level;
                this.scheduler.saveConfidence(this.currentOriginalTune.id, score);
            });
        });

        this.nextTuneBtn.classList.remove('hidden');
        this.nextTuneBtn.addEventListener('click', () => this.loadNextTune());

        // Pool Constraints UI updates
        this.poolSizeInput.addEventListener('change', (e) => {
            this.poolSize = parseInt(e.target.value) || 10;
        });

        // Modal triggers
        this.manageTunesBtn.addEventListener('click', () => this.tuneModal.classList.remove('hidden'));
        this.closeModalBtn.addEventListener('click', () => {
            this.updateSelectedTunesFromModal();
            this.tuneModal.classList.add('hidden');
        });

        // Export/Import triggers
        this.exportBtn.addEventListener('click', () => this.exportConfidenceData());
        this.importBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.importConfidenceData(e));

        this.keyDownBtn.addEventListener('click', () => this.shiftKey(-1));
        this.keyUpBtn.addEventListener('click', () => this.shiftKey(1));
    }

    async initModalList() {
        this.tuneCheckboxList.innerHTML = '';
        for (const id of jazzStandards) {
            try {
                const module = await import(`./data/${id}.js`);
                const tune = module.tune;
                const label = document.createElement('label');
                label.style.display = 'block';
                label.innerHTML = `
                    <input type="checkbox" value="${tune.id}" checked>
                    ${tune.title} (${tune.originalKey})
                `;
                this.tuneCheckboxList.appendChild(label);
            } catch (err) {
                console.error(`Failed to load tune: ${id}`, err);
            }
        }
    }

    updateSelectedTunesFromModal() {
        const checkedInputs = this.tuneCheckboxList.querySelectorAll('input:checked');
        this.selectedTuneIds = Array.from(checkedInputs).map(input => input.value);
    }

    transposeTune(tune, targetKey) {
        // Find the original key's root shift to calculate relative transposition
        const origRootMatch = tune.originalKey.match(/^[A-G][#b]?/i);
        const origRoot = origRootMatch ? origRootMatch[0].toUpperCase() : 'C';
        const origKeyObj = KEYS.find(k => k.name === origRoot);
        const originalShift = origKeyObj ? origKeyObj.shift : 0;

        // Compute structural shift semitones step interval relative to original key
        let randomShift = targetKey.shift - originalShift;

        // Keep shift within a shortest-distance octave range to prevent notes going too high/low
        if (randomShift > 6) randomShift -= 12;
        if (randomShift < -5) randomShift += 12;

        const transposedMelody = tune.melody.map(note => {
            if (note === 'BAR' || note.type === 'BAR') return note;
            return { ...note, pitch: note.pitch + randomShift };
        });

        const transposedChords = tune.chords.map(chord => ({
            ...chord,
            root: chord.root + randomShift
        }));

        // Dynamically compute key suffix descriptor string
        const isMinor = tune.originalKey.toLowerCase().includes('min') || tune.originalKey.toLowerCase().includes('m');
        const keyDisplayName = `${targetKey.name}${isMinor ? 'm' : ''}`;

        return {
            title: tune.title,
            keyName: keyDisplayName,
            melody: transposedMelody,
            chords: transposedChords,
            timeSignature: tune.timeSignature || [4, 4],
            anacrouse: tune.anacrouse || 0
        };
    }

    shiftKey(direction) {
        if (!this.currentOriginalTune) return;

        // Reset loops
        audioEngine.stopChordsLoop();
        this.toggleChordsBtn.textContent = "Loop Chords: OFF";
        this.toggleChordsBtn.classList.remove('primary');

        this.currentTargetKeyIdx += direction;
        if (this.currentTargetKeyIdx < 0) this.currentTargetKeyIdx = KEYS.length - 1;
        if (this.currentTargetKeyIdx >= KEYS.length) this.currentTargetKeyIdx = 0;

        const targetKey = KEYS[this.currentTargetKeyIdx];
        this.currentTransposedTune = this.transposeTune(this.currentOriginalTune, targetKey);

        this.tuneKey.textContent = `Key: ${this.currentTransposedTune.keyName}`;
        this.updateDisplay();
    }

    async loadNextTune() {
        // Reset ongoing loops
        audioEngine.stopChordsLoop();
        this.toggleChordsBtn.textContent = "Loop Chords: OFF";
        this.toggleChordsBtn.classList.remove('primary');

        // Reset UI Components state
        document.querySelectorAll('.conf-btn').forEach(b => b.classList.remove('selected'));
        this.evaluationCard.classList.remove('hidden');

        // Pick next tune using pool limits and choices
        const targetTuneId = this.scheduler.getNextTune(this.selectedTuneIds, this.poolSize);

        if (!targetTuneId) {
            this.tuneTitle.textContent = "No Tunes Selected!";
            this.tuneKey.textContent = "Key: --";
            return;
        }

        try {
            const module = await import(`./data/${targetTuneId}.js`);
            const targetTune = module.tune;

            this.currentOriginalTune = targetTune;

            // Pick absolute random key target context
            this.currentTargetKeyIdx = Math.floor(Math.random() * KEYS.length);
            const randomTargetKey = KEYS[this.currentTargetKeyIdx];
            // const randomTargetKey = { name: this.currentOriginalTune.originalKey, shift: 0}

            this.currentTransposedTune = this.transposeTune(targetTune, randomTargetKey);

            // Update basic text headers
            this.tuneTitle.textContent = this.currentTransposedTune.title;
            this.tuneKey.textContent = `Key: ${this.currentTransposedTune.keyName}`;

            // Populate Performance Link UI Elements
            if (targetTune.youtube) {
                this.ytLink.href = targetTune.youtube;
                this.ytContainer.classList.remove('hidden');
            } else {
                this.ytContainer.classList.add('hidden');
            }

            // Initialize Web Component to completely blank out score elements visually
            this.revealMelodyState = 'empty';
            this.revealChordsState = false;
            this.updateDisplay();
        } catch (err) {
            console.error(`Failed to load tune: ${targetTuneId}`, err);
            this.tuneTitle.textContent = "Error loading tune";
            this.tuneKey.textContent = "Key: --";
        }
    }

    updateDisplay() {
        if (!this.currentTransposedTune) return;

        this.notationDisplay.updateData(
            this.currentTransposedTune.title,
            this.currentTransposedTune.keyName,
            this.currentTransposedTune.melody,
            this.currentTransposedTune.chords,
            this.revealMelodyState,
            this.revealChordsState,
            this.currentTransposedTune.timeSignature,
            this.currentTransposedTune.anacrouse
        );
    }

    exportConfidenceData() {
        const data = localStorage.getItem('jazz_confidence_v1');
        if (!data) {
            alert("No confidence data found to export.");
            return;
        }

        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'jazz_confidence_backup.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    importConfidenceData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (typeof data === 'object') {
                    localStorage.setItem('jazz_confidence_v1', JSON.stringify(data));
                    alert("Confidence data successfully imported! Reloading...");
                    location.reload();
                } else {
                    alert("Invalid file format. Please upload a valid JSON backup.");
                }
            } catch (error) {
                alert("Error parsing the file. Please ensure it is valid JSON.");
            }
            event.target.value = ''; // Reset input
        };
        reader.readAsText(file);
    }
}

// Fire up the engine when document object completes initializing
window.addEventListener('DOMContentLoaded', () => {
    new AppController();
});