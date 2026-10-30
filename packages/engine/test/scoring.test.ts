import { expect, it } from 'vitest';
import { scoreHand, startLevels } from '../src/scoring';

it('scores a pair with the kicker contributing nothing', () => {
  const r = scoreHand([2, 2, 3], startLevels());
  expect(r).toMatchObject({ combo: 'pair', chips: 14, mult: 2, total: 28 });
  expect(r.steps).toEqual([
    { t: 'base', combo: 'pair', chips: 10, mult: 2 },
    { t: 'die', index: 0, chips: 2 },
    { t: 'die', index: 1, chips: 2 },
  ]);
});

it('applies combo levels', () => {
  const levels = { ...startLevels(), pair: 2 };
  expect(scoreHand([2, 2, 3], levels).total).toBe((25 + 4) * 3);
});

it('scores five of a kind and high die', () => {
  expect(scoreHand([10, 10, 10, 10, 10], startLevels()).total).toBe(1500);
  expect(scoreHand([4, 9, 2], startLevels()).total).toBe(14);
});
