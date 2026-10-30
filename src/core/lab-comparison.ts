import { EvolutionLab } from './lab';

export type ComparisonSettings = { seed: number; generations: number; drought: number; predation: number };
export function compareEnvironments(settings: ComparisonSettings) {
  const { seed, generations, drought, predation } = settings;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || !Number.isInteger(generations) || generations < 1 || generations > 300
    || !Number.isFinite(drought) || drought < 0 || drought > 1 || !Number.isFinite(predation) || predation < 0 || predation > 1) throw new Error('对照实验参数超出范围。');
  const control = new EvolutionLab(seed), treatment = new EvolutionLab(seed);
  const rows = [{ generation: 0, control: control.frequency(), treatment: treatment.frequency() }];
  for (let generation = 1; generation <= generations; generation++) {
    control.step(0, predation); treatment.step(drought, predation);
    rows.push({ generation, control: control.frequency(), treatment: treatment.frequency() });
  }
  return { settings: { ...settings }, population: 100, mutation: .003, controlDrought: 0, rows,
    energyResiduals: { control: control.audit(), treatment: treatment.audit() } };
}

export function comparisonCSV(result: ReturnType<typeof compareEnvironments>) {
  const header = 'generation,control_frequency,treatment_frequency,seed,control_drought,treatment_drought,predation,mutation,population';
  return header + '\n' + result.rows.map(row => [row.generation,row.control,row.treatment,result.settings.seed,0,result.settings.drought,result.settings.predation,result.mutation,result.population].join(',')).join('\n') + '\n';
}
