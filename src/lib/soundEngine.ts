class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playCardDeal() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.065);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.065);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    } catch {
      // Ignore audio errors
    }
  }

  public playHit(isSpecial = false) {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const notes = isSpecial ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + idx * 0.055);
        gain.gain.setValueAtTime(0.14, now + idx * 0.055);
        gain.gain.exponentialRampToValueAtTime(0.008, now + idx * 0.055 + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.055);
        osc.stop(now + idx * 0.055 + 0.17);
      });
    } catch {
      // Ignore
    }
  }

  public playFail(isBomb = false) {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      if (isBomb) {
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(32, now + 0.42);
        gain.gain.setValueAtTime(0.24, now);
        gain.gain.exponentialRampToValueAtTime(0.008, now + 0.42);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.43);
      } else {
        osc.frequency.setValueAtTime(165, now);
        osc.frequency.setValueAtTime(115, now + 0.12);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.008, now + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.29);
      }
    } catch {
      // Ignore
    }
  }

  public playSuddenDeathAlert() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      [440, 587.33, 440, 659.25].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.11, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.008, now + i * 0.08 + 0.075);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.08);
      });
    } catch {
      // Ignore
    }
  }

  public playVictory() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const fanfare = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
      const times = [0, 0.09, 0.18, 0.27, 0.42, 0.54];
      fanfare.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + times[idx]);
        gain.gain.setValueAtTime(0.18, now + times[idx]);
        gain.gain.exponentialRampToValueAtTime(0.008, now + times[idx] + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + times[idx]);
        osc.stop(now + times[idx] + 0.24);
      });
    } catch {
      // Ignore
    }
  }

  public speak(phrase: string, rate = 1.18, pitch = 1.05) {
    if (!this.enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(phrase);
      utter.lang = 'es-ES';
      utter.rate = rate;
      utter.pitch = pitch;
      utter.volume = 0.9;
      window.speechSynthesis.speak(utter);
    } catch {
      // Ignore speech errors
    }
  }
}

export const sound = new SoundEngine();
