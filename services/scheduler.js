/**
 * Leitner-inspired Selection Algorithm
 * Prioritizes tunes with low confidence ratings.
 */
export class Scheduler {
    constructor(allTuneIds) {
        this.allTuneIds = allTuneIds;
        // Load existing confidence tracking or instantiate a new one
        this.confidenceMap = JSON.parse(localStorage.getItem('jazz_confidence_v1')) || {};

        // Initialize default scores if empty
        this.allTuneIds.forEach(id => {
            if (!this.confidenceMap[id]) {
                this.confidenceMap[id] = 1; // Default to lowest rating (unlearned)
            }
        });
    }

    saveConfidence(tuneId, level) {
        this.confidenceMap[tuneId] = parseInt(level);
        localStorage.setItem('jazz_confidence_v1', JSON.stringify(this.confidenceMap));
    }

    getNextTune(selectedIds, poolLimit) {
        // Filter down by active user selection settings
        let pool = this.allTuneIds.filter(id => selectedIds.includes(id));

        if (pool.length === 0) return null;

        // Sort pool based on inverted tracking weights (Lower confidence = Higher priority)
        // Weighted probability score generation
        let weightedPool = [];
        pool.forEach(id => {
            const level = this.confidenceMap[id] || 1;
            // Level 1 (Lost) gets 4 entries, Level 4 (Mastered) gets 1 entry
            const weight = Math.max(1, 5 - level);

            for (let i = 0; i < weight; i++) {
                weightedPool.push(id);
            }
        });

        // Limit scope pool if restriction active
        const processingPool = weightedPool.slice(0, poolLimit * 4 || weightedPool.length);
        const randomIndex = Math.floor(Math.random() * processingPool.length);

        return processingPool[randomIndex];
    }

    getConfidenceMap() {
        return this.confidenceMap;
    }
}