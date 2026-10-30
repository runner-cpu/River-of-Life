/** Educational haploid selection model, not a forecast of real species evolution. */
export function seeded(seed: number) { let a = seed >>> 0; return () => { a += 0x6d2b79f5; let t = Math.imul(a ^ a >>> 15, 1 | a); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export type Organism = { genes: number[]; energy: number; x: number; y: number };
export type LabState = { generation: number; population: Organism[]; history: number[]; births: number; deaths: number; energyIn: number; energyOut: number };
export class EvolutionLab {
  random: () => number;
  state: LabState;
  constructor(readonly seed = 20261025, readonly size = 100) {
    this.random = seeded(seed);
    this.state = { generation: 0, population: Array.from({ length: size }, () => ({ genes: Array.from({ length: 14 }, () => +(this.random() > .5)), energy: 10, x: this.random(), y: this.random() })), history: [], births: 0, deaths: 0, energyIn: size * 10, energyOut: 0 };
    this.state.history.push(this.frequency());
  }
  frequency() { return this.state.population.reduce((sum, p) => sum + p.genes[0], 0) / this.state.population.length; }
  step(drought: number, predation = .2, mutation = .003) {
    const pop = this.state.population;
    const weights = pop.map(p => Math.max(.05, 1 + drought * .9 * p.genes[0] - .15 * (1 - drought) * p.genes[0] + predation * .15 * p.genes[1]));
    const total = weights.reduce((a, b) => a + b, 0);
    const next: Organism[] = [];
    for (let i = 0; i < this.size; i++) {
      let pick = this.random() * total, index = 0;
      while (index < pop.length - 1 && pick >= weights[index]) pick -= weights[index++];
      const genes = pop[index].genes.map(g => this.random() < mutation ? 1 - g : g);
      next.push({ genes, energy: 10, x: this.random(), y: this.random() });
    }
    this.state.energyOut += pop.reduce((sum, p) => sum + p.energy, 0);
    this.state.energyIn += this.size * 10;
    this.state.deaths += pop.length; this.state.births += next.length; this.state.population = next; this.state.generation++;
    this.state.history.push(this.frequency()); return this.state;
  }
  audit() { return this.state.energyIn - this.state.energyOut - this.state.population.reduce((sum, p) => sum + p.energy, 0); }
}
