import { expect, it } from 'vitest';
import { makeD10 } from '../src/dice';

it('makeD10 has faces 1-10 with unique ids', () => {
  const d = makeD10('d0');
  expect(d.faces.map((f) => f.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  expect(new Set(d.faces.map((f) => f.id)).size).toBe(10);
});
