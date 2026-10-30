import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EpochAudio } from '../src/modes/epoch-audio';

type FakeOscillator = { disconnect: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; onended?: () => void };
let contexts: FakeContext[];
class FakeContext {
  currentTime = 2; state = 'running'; oscillators: FakeOscillator[] = [];
  gain = { gain: { value: 1, cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
  destination = {};
  close = vi.fn(() => { this.state = 'closed'; return Promise.resolve(); });
  resume = vi.fn(() => Promise.resolve());
  createGain() { return this.gain; }
  createOscillator() { const node = { type: '', frequency: { value: 0 }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: undefined }; this.oscillators.push(node); return node; }
  constructor() { contexts.push(this); }
}
beforeEach(() => { contexts = []; vi.stubGlobal('AudioContext', FakeContext); });
afterEach(() => vi.unstubAllGlobals());

describe('local epoch sound lifecycle', () => {
  it('never constructs audio resources when sound is disabled', () => {
    const audio = new EpochAudio(false, 6); audio.update(.5); audio.setPaused(true); audio.dispose(); expect(contexts).toHaveLength(0);
  });
  it('ramps in quietly and fades before closing its owned graph on exit', async () => {
    const audio = new EpochAudio(true, 6); await Promise.resolve(); const context = contexts[0];
    expect(context.gain.gain.value).toBe(0); expect(context.gain.gain.setTargetAtTime).toHaveBeenCalledWith(.014, 2, .24);
    audio.dispose(); audio.dispose(); expect(context.gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 2, .012);
    context.oscillators.forEach(node => expect(node.stop).toHaveBeenCalledTimes(1)); expect(context.close).not.toHaveBeenCalled();
    context.oscillators[0].onended!(); expect(context.close).toHaveBeenCalledTimes(1); context.oscillators.forEach(node => expect(node.disconnect).toHaveBeenCalledTimes(1)); expect(context.gain.disconnect).toHaveBeenCalledTimes(1);
  });
  it('preserves an immediate pause across async context resume and final volume automation', async () => {
    const audio = new EpochAudio(true, 1); audio.setPaused(true); await Promise.resolve(); const context = contexts[0];
    expect(context.gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 2, .24);
    const calls = context.gain.gain.setTargetAtTime.mock.calls.length; audio.update(.95); expect(context.gain.gain.setTargetAtTime).toHaveBeenCalledTimes(calls);
    audio.setPaused(false); expect(context.gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(.014, 2, .24); audio.dispose(); context.oscillators[0].onended!();
  });
  it('closes suspended contexts immediately because scheduled onended cannot run', () => {
    const audio = new EpochAudio(true, 2), context = contexts[0]; context.state = 'suspended'; audio.dispose();
    expect(context.close).toHaveBeenCalledTimes(1); expect(context.gain.disconnect).toHaveBeenCalledTimes(1);
  });
  it('bounds teardown when the browser suspends the audio clock before onended', () => {
    vi.useFakeTimers();
    try {
      const audio = new EpochAudio(true, 3), context = contexts[0]; audio.dispose(); context.state = 'suspended';
      vi.advanceTimersByTime(120); expect(context.close).toHaveBeenCalledTimes(1);
      context.oscillators[0].onended!(); expect(context.close).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
  it('silently tolerates unavailable audio contexts', () => {
    vi.stubGlobal('AudioContext', class { constructor() { throw new Error('unavailable'); } });
    expect(() => { const audio = new EpochAudio(true, 8); audio.update(.9); audio.dispose(); }).not.toThrow();
  });
});
