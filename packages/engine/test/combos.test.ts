import { describe, expect, it } from 'vitest';
import { detect, type Combo } from '../src/combos';

const cases: [number[], Combo, number[]][] = [
  [[3, 3, 3, 3, 3], 'fiveKind', [0, 1, 2, 3, 4]],
  [[2, 2, 2, 2, 7], 'fourKind', [0, 1, 2, 3]],
  [[1, 1, 1, 3, 3], 'parityHouse', [0, 1, 2, 3, 4]],
  [[1, 1, 1, 2, 2], 'fullHouse', [0, 1, 2, 3, 4]],
  [[2, 3, 4, 5, 6], 'largeStraight', [0, 1, 2, 3, 4]],
  [[6, 6, 6, 1, 2], 'threeKind', [0, 1, 2]],
  [[3, 4, 5, 6, 6], 'smallStraight', [0, 1, 2, 3]],
  [[1, 3, 5, 7, 7], 'parity', [0, 1, 2, 3, 4]],
  [[4, 4, 9, 9, 1], 'twoPair', [0, 1, 2, 3]],
  [[2, 2, 3], 'pair', [0, 1]],
  [[4, 9, 2], 'highDie', [1]],
  [[2, 3, 4, 5], 'smallStraight', [0, 1, 2, 3]],
  [[1, 3, 5, 7], 'highDie', [3]], // parity needs all 5 dice
  [[7, 7, 8], 'pair', [0, 1]],
  [[10, 9, 8, 7, 6], 'largeStraight', [0, 1, 2, 3, 4]],
];

describe('detect', () => {
  it.each(cases)('%j -> %s', (values, combo, scored) => {
    const r = detect(values);
    expect(r.combo).toBe(combo);
    expect([...r.scored].sort((a, b) => a - b)).toEqual(scored);
  });

  it('rejects empty and oversized selections', () => {
    expect(() => detect([])).toThrow();
    expect(() => detect([1, 2, 3, 4, 5, 6])).toThrow();
  });
});
