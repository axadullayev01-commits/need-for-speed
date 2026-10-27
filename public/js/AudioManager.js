/**
 * Procedural Web Audio API Sound Synthesizer
 * Generates dynamic engine roar, tire drift screech, countdown beeps, and collision thuds.
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.initialized = false;

    // Engine sound nodes
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.engineGain = null;

    // Tire screech nodes
    this.screechNoise = null;
    this.screechGain = null;
    this.screechFilter = null;
  }

  init() {
    if (this.initialized) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      this.setupEngineSynth();
      this.setupScreechSynth();
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio not supported or blocked:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setupEngineSynth() {
    // Dual oscillator setup for deep sports car exhaust note
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc2.type = 'triangle';

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 350;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0; // Starts silent until race

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);

    this.engineOsc1.start();
    this.engineOsc2.start();
  }

  setupScreechSynth() {
    // Generate 1-second white noise buffer for tire friction
    const bufferSize = this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.screechNoise = this.ctx.createBufferSource();
    this.screechNoise.buffer = noiseBuffer;
    this.screechNoise.loop = true;

    this.screechFilter = this.ctx.createBiquadFilter();
    this.screechFilter.type = 'bandpass';
    this.screechFilter.frequency.value = 1400;
    this.screechFilter.Q.value = 3.0;

    this.screechGain = this.ctx.createGain();
    this.screechGain.gain.value = 0;

    this.screechNoise.connect(this.screechFilter);
    this.screechFilter.connect(this.screechGain);
    this.screechGain.connect(this.ctx.destination);

    this.screechNoise.start();
  }

  /**
   * Updates continuous engine pitch and tire screech based on speed and drift
   */
  update(speed, throttle, isDrifting) {
    if (!this.initialized || this.isMuted || !this.engineGain) return;

    this.resume();

    const absSpeed = Math.abs(speed);
    const normSpeed = Math.min(1.0, absSpeed / 65.0); // 0 to 1

    // Engine pitch modulates with RPM/speed and throttle
    const baseFreq = 45 + normSpeed * 180 + (throttle > 0 ? 30 : 0);
    const targetFreq1 = baseFreq;
    const targetFreq2 = baseFreq * 1.5;

    const now = this.ctx.currentTime;
    this.engineOsc1.frequency.setTargetAtTime(targetFreq1, now, 0.05);
    this.engineOsc2.frequency.setTargetAtTime(targetFreq2, now, 0.05);

    // Filter opens up as speed increases
    const filterFreq = 300 + normSpeed * 1400;
    this.engineFilter.frequency.setTargetAtTime(filterFreq, now, 0.05);

    // Engine volume
    const targetGain = 0.12 + (throttle !== 0 ? 0.08 : 0.02);
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.05);

    // Tire Screech Volume during drift
    if (isDrifting && absSpeed > 8.0) {
      this.screechGain.gain.setTargetAtTime(0.18, now, 0.04);
    } else {
      this.screechGain.gain.setTargetAtTime(0, now, 0.06);
    }
  }

  stopEngine() {
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    }
    if (this.screechGain && this.ctx) {
      this.screechGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    }
  }

  /**
   * Plays punchy collision impact
   */
  playCollision() {
    if (!this.initialized || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.18);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  /**
   * Plays countdown beep (440Hz for 3,2,1; 880Hz for GO!)
   */
  playCountdownBeep(isGo = false) {
    if (!this.initialized || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const freq = isGo ? 880 : 440;
    const duration = isGo ? 0.45 : 0.22;

    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopEngine();
    }
    return this.isMuted;
  }
}
