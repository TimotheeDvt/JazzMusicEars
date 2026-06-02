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
        this.selectedTuneIds = jazzStandards.map(t => t.id); // All selected by default
        this.poolSize = 10;
        this.revealMelodyState = 'empty';
        this.revealChordsState = false;

        // Cache DOM Elements
        this.tuneTitle = document.getElementById('tune-title');
        this.tuneKey = document.getElementById('tune-key');
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

        // Create Export/Import UI dynamically
        this.exportBtn = document.createElement('button');
        this.exportBtn.textContent = 'Export Data';
        this.importBtn = document.createElement('button');
        this.importBtn.textContent = 'Import Data';
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = '.json';
        this.fileInput.style.display = 'none';

        if (this.manageTunesBtn && this.manageTunesBtn.parentNode) {
            this.manageTunesBtn.parentNode.insertBefore(this.exportBtn, this.manageTunesBtn.nextSibling);
            this.manageTunesBtn.parentNode.insertBefore(this.importBtn, this.exportBtn.nextSibling);
            this.manageTunesBtn.parentNode.insertBefore(this.fileInput, this.importBtn.nextSibling);
        }

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
    }

    initModalList() {
        this.tuneCheckboxList.innerHTML = '';
        jazzStandards.forEach(tune => {
            const label = document.createElement('label');
            label.style.display = 'block';
            label.innerHTML = `
                <input type="checkbox" value="${tune.id}" checked>
                ${tune.title} (${tune.originalKey})
            `;
            this.tuneCheckboxList.appendChild(label);
        });
    }

    updateSelectedTunesFromModal() {
        const checkedInputs = this.tuneCheckboxList.querySelectorAll('input:checked');
        this.selectedTuneIds = Array.from(checkedInputs).map(input => input.value);
    }

    transposeTune(tune, targetKey) {
        // Compute structural shift semitones step interval
        const randomShift = targetKey.shift;

        const transposedMelody = tune.melody.map(note => ({
            ...note,
            pitch: note.pitch + randomShift
        }));

        const transposedChords = tune.chords.map(chord => ({
            ...chord,
            root: chord.root + randomShift
        }));

        // Dynamically compute key suffix descriptor string
        const isMinor = tune.originalKey.toLowerCase().includes('min');
        const keyDisplayName = `${targetKey.name}${isMinor ? 'm' : ''}`;

        return {
            title: tune.title,
            keyName: keyDisplayName,
            melody: transposedMelody,
            chords: transposedChords
        };
    }

    loadNextTune() {
        // Reset ongoing loops
        audioEngine.stopChordsLoop();
        this.toggleChordsBtn.textContent = "Loop Chords: OFF";
        this.toggleChordsBtn.classList.remove('primary');

        // Reset UI Components state
        document.querySelectorAll('.conf-btn').forEach(b => b.classList.remove('selected'));
        this.evaluationCard.classList.remove('hidden');

        // Pick next tune using pool limits and choices
        const targetTune = this.scheduler.getNextTune(this.selectedTuneIds, this.poolSize);

        if (!targetTune) {
            this.tuneTitle.textContent = "No Tunes Selected!";
            this.tuneKey.textContent = "Key: --";
            return;
        }

        this.currentOriginalTune = targetTune;

        // Pick absolute random key target context
        const randomKeyIdx = Math.floor(Math.random() * KEYS.length);
        const randomTargetKey = KEYS[randomKeyIdx];

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
    }

    updateDisplay() {
        if (!this.currentTransposedTune) return;

        this.notationDisplay.updateData(
            this.currentTransposedTune.title,
            this.currentTransposedTune.keyName,
            this.currentTransposedTune.melody,
            this.currentTransposedTune.chords,
            this.revealMelodyState,
            this.revealChordsState
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