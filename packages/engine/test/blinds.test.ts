import { expect, it } from 'vitest';
import { target } from '../src/blinds';

it('uses lowered ante 1 targets', () => {
  expect([target(1, 'small'), target(1, 'big'), target(1, 'boss')]).toEqual([300, 400, 500]);
});

it('uses Balatro base x 1 / 1.5 / 2 from ante 2', () => {
  expect([target(2, 'small'), target(2, 'big'), target(2, 'boss')]).toEqual([800, 1200, 1600]);
  expect(target(8, 'boss')).toBe(100000);
});

it('keeps growing in endless', () => {
  expect(target(9, 'small')).toBeGreaterThan(50000);
  expect(target(10, 'small')).toBeGreaterThan(target(9, 'small'));
});
