import type { Sticker } from '../src/dice';
import { newRun, type RunState } from '../src/run';

export type Spec = number | [number, Sticker];

/** A run whose 5 dice each have one fixed face, so rolls are known. Target is huge so scoring never clears. */
export function fixed(specs: Spec[]): RunState {
  const s = newRun('test');
  s.target = 1e12;
  s.dice = specs.map((spec, i) => {
    const [value, sticker] = Array.isArray(spec) ? spec : [spec];
    return { id: `d${i}`, faces: [{ id: `d${i}x`, value, ...(sticker ? { sticker } : {}) }] };
  });
  s.shown = s.dice.map((d) => d.faces[0].id);
  return s;
}

export const faces = (specs: Spec[]) => fixed([...specs, ...Array(5 - specs.length).fill(1)]).dice.slice(0, specs.length).map((d) => d.faces[0]);
