import { describe, expect, it } from 'vitest';
import { EvolutionLab } from '../src/core/lab';

describe('educational evolution model', () => {
  it('reproduces every organism and generation with the same seed', () => {
    const a = new EvolutionLab(12345), b = new EvolutionLab(12345);
    for (let i = 0; i < 30; i++) { a.step(.8, .4, .01); b.step(.8, .4, .01); }
    expect(a.state).toEqual(b.state);
    expect(a.state).not.toEqual(new EvolutionLab(54321).state);
  });

  it('strong drought enriches the drought-associated allele across independent seeds', () => {
    let drought = 0, control = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const selected = new EvolutionLab(seed, 80), baseline = new EvolutionLab(seed, 80);
      for (let generation = 0; generation < 20; generation++) { selected.step(1, 0, 0); baseline.step(0, 0, 0); }
      drought += selected.frequency(); control += baseline.frequency();
    }
    expect(drought / 60).toBeGreaterThan(.9);
    expect((drought - control) / 60).toBeGreaterThan(.55);
  });

  it('neutral drift has replicate variance without a systematic directional bias', () => {
    const changes: number[] = [];
    for (let seed = 1; seed <= 160; seed++) {
      const lab = new EvolutionLab(seed, 60), initial = lab.frequency();
      // 0.9*d - 0.15*(1-d) = 0 at d=1/7; drought=0 includes a trait cost.
      for (let generation = 0; generation < 30; generation++) lab.step(1 / 7, 0, 0);
      changes.push(lab.frequency() - initial);
    }
    const mean = changes.reduce((sum, value) => sum + value, 0) / changes.length;
    const variance = changes.reduce((sum, value) => sum + (value - mean) ** 2, 0) / changes.length;
    expect(Math.abs(mean)).toBeLessThan(.07); expect(variance).toBeGreaterThan(.025);
    expect(changes.some(v => v > .2)).toBe(true); expect(changes.some(v => v < -.2)).toBe(true);
  });

  it('conserves the exact energy ledger and population counts over generations', () => {
    const lab = new EvolutionLab(987, 73);
    expect(lab.audit()).toBe(0);
    for (let generation = 1; generation <= 100; generation++) {
      lab.step((generation % 11) / 10, .3, .02);
      expect(lab.audit()).toBe(0); expect(lab.state.population).toHaveLength(73);
      expect(lab.state.births).toBe(generation * 73); expect(lab.state.deaths).toBe(generation * 73);
      expect(lab.state.energyIn).toBe((generation + 1) * 730); expect(lab.state.energyOut).toBe(generation * 730);
    }
  });
});
