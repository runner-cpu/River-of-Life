/** Quiet local synthesis: no downloaded audio and no abrupt impact transient. */
export class EpochAudio {
  private context?: AudioContext;
  private gain?: GainNode;
  private oscillators: OscillatorNode[] = [];
  private disposed = false;
  private paused = false;
  constructor(enabled: boolean, chapter: number) {
    if (!enabled) return;
    try {
      const context = new AudioContext(); this.context = context;
      const gain = context.createGain(); this.gain = gain; gain.gain.value = 0; gain.connect(context.destination);
      const base = [98, 130.81, 87.31, 73.42, 110, 82.41, 146.83, 174.61][chapter - 1] || 110;
      for (const ratio of [1, 1.5]) { const oscillator = context.createOscillator(); oscillator.type = 'sine'; oscillator.frequency.value = base * ratio; oscillator.connect(gain); oscillator.start(); this.oscillators.push(oscillator); }
      void context.resume().then(() => { if (!this.disposed) this.setPaused(this.paused); }).catch(() => this.dispose());
    } catch { this.dispose(); }
  }
  setPaused(paused: boolean) {
    this.paused = paused;
    if (this.disposed || !this.context || !this.gain) return;
    const now = this.context.currentTime; this.gain.gain.cancelScheduledValues(now); this.gain.gain.setTargetAtTime(paused ? 0 : .014, now, .24);
  }
  update(progress: number) {
    if (progress > .85 && this.context && this.gain && !this.disposed && !this.paused) this.gain.gain.setTargetAtTime(Math.max(0, 1 - progress) * .014 / .15, this.context.currentTime, .15);
  }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    const context = this.context, gain = this.gain, oscillators = this.oscillators;
    this.context = undefined; this.gain = undefined; this.oscillators = [];
    if (!context) return;
    let released = false, releaseTimer: ReturnType<typeof setTimeout> | undefined;
    const release = () => { if (released) return; released = true; clearTimeout(releaseTimer); oscillators.forEach(node => node.disconnect()); gain?.disconnect(); if (context.state !== 'closed') void context.close().catch(() => {}); };
    try {
      if (context.state === 'running' && oscillators.length) {
        const now = context.currentTime; gain?.gain.cancelScheduledValues(now); gain?.gain.setTargetAtTime(0, now, .012);
        oscillators[0].onended = release; oscillators.forEach(node => node.stop(now + .06));
        // Browser tab suspension can stall audio-clock onended; teardown must still finish.
        releaseTimer = setTimeout(release, 120);
      } else { oscillators.forEach(node => { try { node.stop(); } catch { /* already stopped */ } }); release(); }
    } catch { release(); }
  }
}
