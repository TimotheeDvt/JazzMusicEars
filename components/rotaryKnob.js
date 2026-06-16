/**
 * Custom Web Component: <rotary-knob>
 * Provides a tactile dial for volume and parameter control.
 */
export class RotaryKnob extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._value = 1;
        this.isDragging = false;
        this.startY = 0;
        this.startVal = 0;
    }

    static get observedAttributes() {
        return ['value'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'value' && !this.isDragging) {
            this.value = parseFloat(newValue);
        }
    }

    get value() { return this._value; }

    set value(val) {
        this._value = Math.max(0, Math.min(1, val));
        this.updateRotation();
    }

    connectedCallback() {
        if (this.hasAttribute('value')) {
            this._value = parseFloat(this.getAttribute('value'));
        }

        this.shadowRoot.innerHTML = `
            <style>
                :host { display: inline-block; width: 44px; height: 44px; cursor: pointer; user-select: none; -webkit-user-select: none; touch-action: none; }
                .knob-container { width: 100%; height: 100%; border-radius: 50%; background-color: #cbd5e1; background-image: conic-gradient(from 225deg, #38bdf8 0deg, #38bdf8 var(--fill-angle, 270deg), transparent var(--fill-angle, 270deg)); box-shadow: inset 0 2px 4px rgba(0,0,0,0.2), 0 2px 4px rgba(255,255,255,0.5); position: relative; display: flex; justify-content: center; align-items: center; }
                .knob-dial { width: 75%; height: 75%; border-radius: 50%; background: #1e293b; box-shadow: 0 2px 5px rgba(0,0,0,0.4); position: absolute; transform: rotate(0deg); transition: transform 0.05s ease-out; z-index: 2; }
                .knob-indicator { position: absolute; width: 4px; height: 35%; background: #38bdf8; top: 12%; left: calc(50% - 2px); border-radius: 2px; }
                .tick { position: absolute; width: 3px; height: 3px; border-radius: 50%; background: #0f172a; opacity: 0.4; z-index: 1; }
                .tooltip { position: absolute; top: 40px; left: 50%; transform: translateX(-50%); background: rgba(15, 23, 42, 0.9); color: #f8fafc; padding: 2px 6px; border-radius: 4px; font-size: 12px; font-family: sans-serif; pointer-events: none; opacity: 1; transition: opacity 0.1s ease-in-out; z-index: 10; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
            </style>
            <div class="knob-container" title="Drag up/down to adjust">
                <div class="tooltip" id="tooltip">1.0</div>
                <div class="tick" style="transform: rotate(-135deg) translate(0, -19px);"></div>
                <div class="tick" style="transform: rotate(-67.5deg) translate(0, -19px);"></div>
                <div class="tick" style="transform: rotate(0deg) translate(0, -19px);"></div>
                <div class="tick" style="transform: rotate(67.5deg) translate(0, -19px);"></div>
                <div class="tick" style="transform: rotate(135deg) translate(0, -19px);"></div>
                <div class="knob-dial" id="dial">
                    <div class="knob-indicator"></div>
                </div>
            </div>
        `;

        this.dial = this.shadowRoot.getElementById('dial');
        this.tooltip = this.shadowRoot.getElementById('tooltip');
        this.updateRotation();

        this.addEventListener('mousedown', this.onPointerDown.bind(this));
        this.addEventListener('touchstart', this.onPointerDown.bind(this), { passive: false });
    }

    updateRotation() {
        if (!this.dial) return;
        // Map 0 -> -135deg, 1 -> 135deg (270 degrees total spin)
        const angle = -135 + (this._value * 270);
        this.dial.style.transform = `rotate(${angle}deg)`;
        this.style.setProperty('--fill-angle', `${this._value * 270}deg`);
        if (this.tooltip) {
            this.tooltip.textContent = this._value.toFixed(1);
        }
    }

    onPointerDown(e) {
        e.preventDefault();
        this.isDragging = true;
        this.startY = e.touches ? e.touches[0].clientY : e.clientY;
        this.startVal = this._value;
        this.dial.style.transition = 'none'; // Disable smoothing while actively dragging
        // this.tooltip.classList.add('visible');

        this._onPointerMove = this.onPointerMove.bind(this);
        this._onPointerUp = this.onPointerUp.bind(this);

        window.addEventListener('mousemove', this._onPointerMove);
        window.addEventListener('mouseup', this._onPointerUp);
        window.addEventListener('touchmove', this._onPointerMove, { passive: false });
        window.addEventListener('touchend', this._onPointerUp);
    }

    onPointerMove(e) {
        if (!this.isDragging) return;
        e.preventDefault();
        const currentY = e.touches ? e.touches[0].clientY : e.clientY;
        const deltaY = this.startY - currentY; // Moving up increases the value

        let newVal = this.startVal + (deltaY / 150); // 150px drag span for 0-100%
        newVal = Math.max(0, Math.min(1, newVal));

        // Snap to nearest 0.1
        newVal = Math.round(newVal * 10) / 10;

        if (newVal !== this._value) {
            this.value = newVal;
            this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        }
    }

    onPointerUp() {
        this.isDragging = false;
        this.dial.style.transition = 'transform 0.05s ease-out';
        // this.tooltip.classList.remove('visible');
        window.removeEventListener('mousemove', this._onPointerMove);
        window.removeEventListener('mouseup', this._onPointerUp);
        window.removeEventListener('touchmove', this._onPointerMove);
        window.removeEventListener('touchend', this._onPointerUp);
    }
}

customElements.define('rotary-knob', RotaryKnob);