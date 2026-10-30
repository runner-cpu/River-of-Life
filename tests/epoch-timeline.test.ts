import { describe, expect, it } from 'vitest';
import { chapters } from '../src/content/chapters';
import { EPOCHS, EPOCH_DURATION, EpochClock, sampleCamera } from '../src/scene/epoch-timeline';

describe('epoch coverage and camera paths', () => {
  it('gives every source chapter a unique named theme and three nonempty captions', () => {
    expect(Object.keys(EPOCHS).map(Number)).toEqual(chapters.map(chapter => chapter.id));
    expect(new Set(Object.values(EPOCHS).map(epoch => epoch.theme)).size).toBe(8);
    expect(new Set(Object.values(EPOCHS).map(epoch => epoch.color)).size).toBe(8);
    for (const definition of Object.values(EPOCHS)) {
      expect(definition.stages).toHaveLength(3); expect(definition.stages.every(stage => stage.length > 5)).toBe(true);
      expect(definition.cameras[0].at).toBe(0); expect(definition.cameras.at(-1)!.at).toBe(1);
      expect(definition.cameras.every((key, index, keys) => index === 0 || key.at > keys[index - 1].at)).toBe(true);
    }
  });
  it.each(chapters.map(chapter => [chapter.id]))('samples finite, clamped, continuous camera paths for chapter %s', id => {
    const keys = EPOCHS[id].cameras;
    expect(sampleCamera(keys, -1).position).toEqual(keys[0].position);
    expect(sampleCamera(keys, 2).position).toEqual(keys.at(-1)!.position);
    for (let step = 1; step <= 1000; step++) {
      const before = sampleCamera(keys, (step - 1) / 1000), after = sampleCamera(keys, step / 1000);
      const distance = Math.hypot(...after.position.map((value, axis) => value - before.position[axis]));
      expect(distance).toBeLessThan(.11); expect(after.position.every(Number.isFinite)).toBe(true);
    }
    for (const key of keys.slice(1, -1)) {
      const before = sampleCamera(keys, key.at - .00001), after = sampleCamera(keys, key.at + .00001);
      expect(Math.hypot(...after.position.map((value, axis) => value - before.position[axis]))).toBeLessThan(.000001);
    }
  });
});

describe('single-owner playback clock', () => {
  it('finishes once at ten seconds and remains readable until explicitly closed', () => {
    const clock = new EpochClock(); expect(clock.duration).toBe(EPOCH_DURATION);
    clock.tick(200); clock.tick(5200); expect(clock.elapsed).toBe(5);
    clock.tick(10500); expect(clock.elapsed).toBe(10); expect(clock.status).toBe('summary');
    clock.tick(90000); clock.resume(90000); expect(clock.elapsed).toBe(10); expect(clock.status).toBe('summary');
  });
  it('excludes all paused time and resets the timestamp on resume', () => {
    const clock = new EpochClock(); clock.tick(1000); clock.pause(2500);
    expect(clock.elapsed).toBe(1.5); clock.tick(20000); expect(clock.elapsed).toBe(1.5);
    clock.resume(50000); clock.tick(51000); expect(clock.elapsed).toBe(2.5); expect(clock.status).toBe('playing');
  });
  it('allows paused skip to summary and cannot revive after closure', () => {
    const clock = new EpochClock(); clock.tick(0); clock.pause(1000); clock.finish();
    expect(clock.status).toBe('summary'); expect(clock.elapsed).toBe(10);
    clock.close(); clock.close(); clock.resume(40000); clock.finish(); clock.tick(50000);
    expect(clock.status).toBe('closed'); expect(clock.elapsed).toBe(10);
  });
  it('supports the nine second isolated demo without coupling it to rendering', () => {
    const clock = new EpochClock(9); clock.tick(100); clock.tick(9099);
    expect(clock.status).toBe('playing'); clock.tick(9100); expect(clock.status).toBe('summary'); expect(clock.elapsed).toBe(9);
  });
  it('rejects backward wall clock movement as negative elapsed time', () => {
    const clock = new EpochClock(); clock.tick(2000); clock.tick(1000); expect(clock.elapsed).toBe(0);
  });
});
