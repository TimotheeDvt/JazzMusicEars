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
        this.revealMelodyState = 'empty';
        this.revealChordsState = false;
        this.displayMode = 'both';
        this.activePlayback = null;
        this.playbackTimeout = null;
        this.playheadAnimationId = null;

        // Cache DOM Elements
        this.tuneKey = document.getElementById('tune-key');
        this.keyDownBtn = document.getElementById('key-down-btn');
        this.keyUpBtn = document.getElementById('key-up-btn');
        this.notationDisplay = document.getElementById('notation-display');
        this.tempoInput = document.getElementById('tempo');
        this.clickTrackCheckbox = document.getElementById('click-track');
        this.displayModeSelect = document.getElementById('display-mode');
        this.keyResetBtn = document.getElementById('key-reset-btn');

        // Buttons
        this.playBothBtn = document.getElementById('play-both-btn');
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

        audioEngine.tempo = parseInt(this.tempoInput.value) || 120;
        audioEngine.setClickEnabled(true);

        this.initEventListeners();
        this.initModalList();
        this.loadNextTune();
    }

    initEventListeners() {
        this.playBothBtn.addEventListener('click', () => {
            if (this.activePlayback === 'both') {
                this.stopPlayback();
            } else {
                this.stopPlayback();
                if (this.currentTransposedTune) {
                    this.activePlayback = 'both';
                    this.playBothBtn.textContent = "Stop Both";
                    const duration = audioEngine.playBoth(this.currentTransposedTune.melody, this.currentTransposedTune.chords, 0);
                    const totalBeats = duration / audioEngine.secPerBeat;
                    this.startPlayhead(0, totalBeats, false);
                    this.playbackTimeout = setTimeout(() => this.stopPlayback(), duration * 1000);
                }
            }
        });

        this.playMelodyBtn.addEventListener('click', () => {
            if (this.activePlayback === 'melody') {
                this.stopPlayback();
            } else {
                this.stopPlayback();
                if (this.currentTransposedTune) {
                    this.activePlayback = 'melody';
                    this.playMelodyBtn.textContent = "Stop Melody";
                    const duration = audioEngine.playMelody(this.currentTransposedTune.melody, 0);
                    const totalBeats = duration / audioEngine.secPerBeat;
                    this.startPlayhead(0, totalBeats, false);
                    this.playbackTimeout = setTimeout(() => this.stopPlayback(), duration * 1000);
                }
            }
        });

        this.toggleChordsBtn.addEventListener('click', () => {
            if (!this.currentTransposedTune) return;

            if (this.activePlayback === 'chords') {
                this.stopPlayback();
            } else {
                this.stopPlayback();
                const totalBeats = audioEngine.startChordsLoop(this.currentTransposedTune.chords, 0);
                if (totalBeats > 0) {
                    this.activePlayback = 'chords';
                    this.toggleChordsBtn.textContent = "Stop Chords 🔄";
                    this.toggleChordsBtn.classList.add('primary');
                    this.startPlayhead(0, totalBeats, true);
                }
            }
        });

        this.revealFirstBtn.addEventListener('click', () => {
            this.revealMelodyState = this.revealMelodyState === 'first' ? 'empty' : 'first';
            this.updateDisplay();
        });

        this.revealMelodyBtn.addEventListener('click', () => {
            this.revealMelodyState = this.revealMelodyState === 'full' ? 'empty' : 'full';
            this.updateDisplay();
        });

        this.revealChordsBtn.addEventListener('click', () => {
            this.revealChordsState = !this.revealChordsState;
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

        this.tempoInput.addEventListener('change', (e) => {
            this.stopPlayback();
            audioEngine.tempo = parseInt(e.target.value) || 120;
        });

        this.displayModeSelect.addEventListener('change', (e) => {
            this.displayMode = e.target.value;
            this.updateDisplay();
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
        this.keyResetBtn.addEventListener('click', () => this.resetToOriginalKey());

        this.notationDisplay.addEventListener('seek', (e) => {
            const beat = e.detail.beat;
            this.seekAndPlay(beat);
        });

        // Volume Controls
        document.getElementById('melody-volume').addEventListener('input', (e) => audioEngine.setMelodyVolume(parseFloat(e.target.value)));
        document.getElementById('chord-volume').addEventListener('input', (e) => audioEngine.setChordVolume(parseFloat(e.target.value)));
        document.getElementById('click-volume').addEventListener('input', (e) => audioEngine.setClickVolume(parseFloat(e.target.value)));
    }

    async initModalList() {
        this.tuneCheckboxList.innerHTML = '';
        for (const id of jazzStandards) {
            try {
                const module = await import(`./data/tuneFiles/${id}.js`);
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
            if (note === 'BAR' || note.type === 'BAR' || note.type === 'REPEAT_START' || note.type === 'REPEAT_END' || note.type === 'ENDING_1' || note.type === 'ENDING_2' || note.isRest) return note;
            const transposedNote = { ...note, pitch: note.pitch + randomShift };
            if (randomShift !== 0) {
                delete transposedNote.stringNum;
            }
            return transposedNote;
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
            anacrouse: tune.anacrouse || 0,
            originalTempo: tune.originalTempo || 120,
            visualTranspose: tune.visualTranspose || 0
        };
    }

    shiftKey(direction) {
        if (!this.currentOriginalTune) return;

        this.stopPlayback();

        this.currentTargetKeyIdx += direction;
        if (this.currentTargetKeyIdx < 0) this.currentTargetKeyIdx = KEYS.length - 1;
        if (this.currentTargetKeyIdx >= KEYS.length) this.currentTargetKeyIdx = 0;

        const targetKey = KEYS[this.currentTargetKeyIdx];
        this.currentTransposedTune = this.transposeTune(this.currentOriginalTune, targetKey);

        this.tuneKey.textContent = `Key: ${this.currentTransposedTune.keyName}`;
        this.updateDisplay();
    }

    resetToOriginalKey() {
        if (!this.currentOriginalTune) return;

        this.stopPlayback();

        // Extract absolute original key target
        const origRootMatch = this.currentOriginalTune.originalKey.match(/^[A-G][#b]?/i);
        const origRoot = origRootMatch ? origRootMatch[0].toUpperCase() : 'C';
        const origIdx = KEYS.findIndex(k => k.name === origRoot);

        if (origIdx !== -1) {
            this.currentTargetKeyIdx = origIdx;
            const targetKey = KEYS[this.currentTargetKeyIdx];
            this.currentTransposedTune = this.transposeTune(this.currentOriginalTune, targetKey);
            this.tuneKey.textContent = `Key: ${this.currentTransposedTune.keyName}`;
            this.updateDisplay();
        }
    }

    stopPlayback() {
        audioEngine.stopAll();
        clearTimeout(this.playbackTimeout);
        cancelAnimationFrame(this.playheadAnimationId);
        if (this.notationDisplay && typeof this.notationDisplay.setPlayhead === 'function') {
            this.notationDisplay.setPlayhead(null);
        }
        this.activePlayback = null;
        this.playBothBtn.textContent = "Play Both";
        this.playMelodyBtn.textContent = "Play Melody";
        this.toggleChordsBtn.textContent = "Loop Chords: OFF";
        this.toggleChordsBtn.classList.remove('primary');
    }

    seekAndPlay(startBeat) {
        if (!this.currentTransposedTune) return;

        const mode = this.activePlayback || 'both'; // Default to playing both if playback is fully stopped

        this.stopPlayback();

        if (mode === 'both') {
            this.activePlayback = 'both';
            this.playBothBtn.textContent = "Stop Both";
            const duration = audioEngine.playBoth(this.currentTransposedTune.melody, this.currentTransposedTune.chords, startBeat);
            const totalBeats = (duration / audioEngine.secPerBeat) + startBeat;
            this.startPlayhead(startBeat, totalBeats, false);
            this.playbackTimeout = setTimeout(() => this.stopPlayback(), duration * 1000);
        } else if (mode === 'melody') {
            this.activePlayback = 'melody';
            this.playMelodyBtn.textContent = "Stop Melody";
            const duration = audioEngine.playMelody(this.currentTransposedTune.melody, startBeat);
            const totalBeats = (duration / audioEngine.secPerBeat) + startBeat;
            this.startPlayhead(startBeat, totalBeats, false);
            this.playbackTimeout = setTimeout(() => this.stopPlayback(), duration * 1000);
        } else if (mode === 'chords') {
            const totalBeats = audioEngine.startChordsLoop(this.currentTransposedTune.chords, startBeat);
            if (totalBeats > 0) {
                this.activePlayback = 'chords';
                this.toggleChordsBtn.textContent = "Stop Chords 🔄";
                this.toggleChordsBtn.classList.add('primary');
                this.startPlayhead(startBeat, totalBeats, true);
            }
        }
    }

    startPlayhead(startBeat, totalBeats, isLoop = false) {
        const startTime = audioEngine.ctx.currentTime;
        const animate = () => {
            if (!this.activePlayback) return;

            const elapsed = audioEngine.ctx.currentTime - startTime;
            let currentBeat = startBeat + (elapsed / audioEngine.secPerBeat);

            if (isLoop && totalBeats > 0) {
                if (currentBeat >= totalBeats) currentBeat = currentBeat % totalBeats;
            } else if (currentBeat > totalBeats) {
                currentBeat = totalBeats;
            }

            if (this.notationDisplay) this.notationDisplay.setPlayhead(currentBeat);

            if (isLoop || currentBeat < totalBeats) {
                this.playheadAnimationId = requestAnimationFrame(animate);
            }
        };
        this.playheadAnimationId = requestAnimationFrame(animate);
    }

    async loadNextTune() {
        this.stopPlayback();

        // Reset UI Components state
        document.querySelectorAll('.conf-btn').forEach(b => b.classList.remove('selected'));
        this.evaluationCard.classList.remove('hidden');

        // Pick next tune
        const targetTuneId = this.scheduler.getNextTune(this.selectedTuneIds);

        if (!targetTuneId) {
            this.tuneKey.textContent = "Key: --";
            this.notationDisplay.updateData("No Tunes Selected!", "C", [], []);
            return;
        }

        try {
            const module = await import(`./data/tuneFiles/${targetTuneId}.js`);
            const targetTune = module.tune;

            this.currentOriginalTune = targetTune;

            // Pick absolute random key target context
            this.currentTargetKeyIdx = Math.floor(Math.random() * KEYS.length);
            const randomTargetKey = KEYS[this.currentTargetKeyIdx];
            // const randomTargetKey = { name: this.currentOriginalTune.originalKey, shift: 0}

            this.currentTransposedTune = this.transposeTune(targetTune, randomTargetKey);

            // Set Original Tempo
            this.tempoInput.value = this.currentTransposedTune.originalTempo;
            audioEngine.tempo = this.currentTransposedTune.originalTempo;

            // Update basic text headers
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
            this.tuneKey.textContent = "Key: --";
            this.notationDisplay.updateData("Error loading tune", "C", [], []);
        }
    }

    updateButtonStates() {
        if (this.revealMelodyState === 'first') {
            this.revealFirstBtn.textContent = "Hide First";
            this.revealMelodyBtn.textContent = "Reveal Melody";
        } else if (this.revealMelodyState === 'full') {
            this.revealFirstBtn.textContent = "Reveal First";
            this.revealMelodyBtn.textContent = "Hide Melody";
        } else {
            this.revealFirstBtn.textContent = "Reveal First";
            this.revealMelodyBtn.textContent = "Reveal Melody";
        }

        this.revealChordsBtn.textContent = this.revealChordsState ? "Hide Chords" : "Reveal Chords";
    }

    updateDisplay() {
        if (!this.currentTransposedTune) return;

        this.updateButtonStates();

        this.notationDisplay.updateData(
            this.currentTransposedTune.title,
            this.currentTransposedTune.keyName,
            this.currentTransposedTune.melody,
            this.currentTransposedTune.chords,
            this.revealMelodyState,
            this.revealChordsState,
            this.currentTransposedTune.timeSignature,
            this.currentTransposedTune.anacrouse,
            this.displayMode,
            this.currentTransposedTune.visualTranspose
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