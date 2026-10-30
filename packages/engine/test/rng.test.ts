import { describe, expect, it } from 'vitest';
import { int, makeRng, next } from '../src/rng';

describe('rng', () => {
  it('is deterministic per seed and stream', () => {
    const a = makeRng('seed', 'dice');
    const b = makeRng('seed', 'dice');
    expect([next(a), next(a), next(a)]).toEqual([next(b), next(b), next(b)]);
  });

  it('gives independent streams', () => {
    const a = makeRng('seed', 'dice');
    const b = makeRng('seed', 'shop');
    expect(next(a)).not.toEqual(next(b));
  });

  it('int stays in range', () => {
    const r = makeRng('x', 'y');
    for (let i = 0; i < 1000; i++) {
      const v = int(r, 10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
    }
  });

  it('survives a JSON round trip', () => {
    const r = makeRng('x', 'y');
    next(r);
    const copy = JSON.parse(JSON.stringify(r));
    expect(next(copy)).toEqual(next(r));
  });
});
