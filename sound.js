/**
 * sound.js - Web Audio API Synthesizer for Flappy Bird Premium
 * Generates rich, authentic retro sound effects procedurally without external file dependencies.
 */

class SoundEffects {
    constructor() {
        this.ctx = null;
        this.muted = false;
    }

    /**
     * Lazy initialization of the AudioContext to comply with browser autoplay policies.
     */
    init() {
        if (!this.ctx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                this.ctx = new AudioContextClass();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /**
     * Sets the mute state of the synthesizer.
     * @param {boolean} isMuted 
     */
    setMuted(isMuted) {
        this.muted = isMuted;
        if (!isMuted) {
            this.init();
        }
    }

    /**
     * Play a clean retro jump sound (upward frequency sweep).
     */
    playJump() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle'; // Smooth retro sound
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.15);
    }

    /**
     * Play a satisfying coin collection sound (classic two-tone retro beep).
     */
    playCoin() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square'; // Classic 8-bit sound
        // Mario coin style: B5 (987.77 Hz) for 0.08s, then E6 (1318.51 Hz) for 0.25s
        osc.frequency.setValueAtTime(988, now);
        osc.frequency.setValueAtTime(1319, now + 0.08);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.setValueAtTime(0.08, now + 0.08);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.3);
    }

    /**
     * Play a score point sound (double harmonic beep).
     */
    playScore() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.setValueAtTime(0.1, now + 0.08);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.2);
    }

    /**
     * Play a futuristic arpeggio when collecting a power-up.
     */
    playPowerup() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const duration = 0.4;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth'; // Futuristic synth sound
        
        // Fast arpeggio: C5 -> E5 -> G5 -> C6
        const freqValues = [523, 659, 784, 1046];
        const step = duration / freqValues.length;

        freqValues.forEach((freq, idx) => {
            osc.frequency.setValueAtTime(freq, now + idx * step);
        });

        // Add a lowpass filter to make the sawtooth sound warmer and retro-future
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, now);
        filter.frequency.exponentialRampToValueAtTime(800, now + duration);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0.001, now + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + duration);
    }

    /**
     * Play a shield-break sound (descending crash sound).
     */
    playShieldBreak() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.35);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.35);

        // Add a bit of frequency modulation or filter sweep to make it feel "broken"
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.setValueAtTime(600, now);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.35);
    }

    /**
     * Play a deep impact crash sound when game over occurs (noise/pitch downward explosion).
     */
    playCrash() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const noiseGain = this.ctx.createGain();
        
        // Lower pitch rumble sweep
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.linearRampToValueAtTime(40, now + 0.6);

        noiseGain.gain.setValueAtTime(0.25, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, now);

        osc.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.6);
        
        // Add a secondary noise-like burst for crunch
        try {
            const bufferSize = this.ctx.sampleRate * 0.25; // 1/4 second noise burst
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            
            const noiseFilter = this.ctx.createBiquadFilter();
            noiseFilter.type = 'bandpass';
            noiseFilter.frequency.value = 300;
            
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.15, now);
            nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
            
            noise.connect(noiseFilter);
            noiseFilter.connect(nGain);
            nGain.connect(this.ctx.destination);
            
            noise.start(now);
            noise.stop(now + 0.25);
        } catch (e) {
            // Fallback if noise buffer creation fails on some browsers
        }
    }

    /**
     * Play a clean click sound for UI buttons.
     */
    playClick() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.05);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.05);
    }
}
