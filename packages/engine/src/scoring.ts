import { BASE, COMBOS, detect, type Combo } from './combos';

export type Levels = Record<Combo, number>;

export const startLevels = (): Levels => Object.fromEntries(COMBOS.map((c) => [c, 1])) as Levels;

export function comboBase(combo: Combo, level: number) {
  const b = BASE[combo];
  return { chips: b.chips + b.lvlChips * (level - 1), mult: b.mult + b.lvlMult * (level - 1) };
}

export type ScoreStep =
  | { t: 'base'; combo: Combo; chips: number; mult: number }
  | { t: 'die'; index: number; chips: number };

export type ScoreResult = {
  combo: Combo;
  scored: number[];
  chips: number;
  mult: number;
  total: number;
  steps: ScoreStep[];
};

/** Base scoring (design §5 steps 1-2). Indices refer to positions in `values`. */
export function scoreHand(values: number[], levels: Levels): ScoreResult {
  const { combo, scored } = detect(values);
  let { chips, mult } = comboBase(combo, levels[combo]);
  const steps: ScoreStep[] = [{ t: 'base', combo, chips, mult }];
  for (const i of [...scored].sort((a, b) => a - b)) {
    chips += values[i];
    steps.push({ t: 'die', index: i, chips: values[i] });
  }
  return { combo, scored, chips, mult, total: Math.floor(chips * mult), steps };
}
