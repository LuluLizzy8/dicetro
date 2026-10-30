import { describe, expect, it } from 'vitest';
import { detect, type Combo } from '../src/combos';
import { faces, type Spec } from './helpers';

const cases: [Spec[], Combo, number[]][] = [
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
  // stickers
  [[1, 3, [4, 'wild'], 7, 9], 'parity', [0, 1, 2, 3, 4]],
  [[1, 1, 1, [2, 'wild'], [2, 'wild']], 'parityHouse', [0, 1, 2, 3, 4]],
  [[[4, 'stone'], 4, 9], 'highDie', [0, 2]], // Stone 4 doesn't pair with the 4
  [[[4, 'stone'], 6, 6], 'pair', [0, 1, 2]],
  [[[4, 'stone'], [5, 'stone']], 'highDie', [0, 1]],
];

describe('detect', () => {
  it.each(cases)('%j -> %s', (specs, combo, scored) => {
    const r = detect(faces(specs));
    expect(r.combo).toBe(combo);
    expect([...r.scored].sort((a, b) => a - b)).toEqual(scored);
  });

  it('rejects empty and oversized selections', () => {
    expect(() => detect([])).toThrow();
    expect(() => detect([...faces([1, 2, 3, 4, 5]), ...faces([6])])).toThrow();
  });

  it('Short Ladder: 4-die Large Straight and Parity', () => {
    const rules = { shortLadder: true };
    expect(detect(faces([2, 3, 4, 5]), rules)).toEqual({ combo: 'largeStraight', scored: [0, 1, 2, 3] });
    expect(detect(faces([1, 3, 5, 9, 2]), rules)).toEqual({ combo: 'parity', scored: [0, 1, 2, 3] });
  });
});
