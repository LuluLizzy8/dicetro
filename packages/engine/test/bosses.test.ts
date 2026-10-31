import { describe, expect, it } from 'vitest';
import { boss, pickBoss } from '../src/bosses';
import { makeRng } from '../src/rng';
import { addJoker, apply, newRun, type RunState } from '../src/run';
import { scoreHand } from '../src/scoring';
import { fixed } from './helpers';

/** Puts a run right before the boss blind of `ante` with a forced boss, then starts it. */
function atBoss(id: RunState['boss'], ante = 3): RunState {
  const s = newRun('boss');
  Object.assign(s, { phase: 'shop', ante, blind: 'big', boss: id });
  return apply(s, { t: 'next' }).state;
}

describe('boss selection', () => {
  it('respects minimum antes and gives finishers every 8th ante', () => {
    const r = makeRng('x', 'boss');
    for (let i = 0; i < 200; i++) {
      expect(boss(pickBoss(1, r)).minAnte ?? 1).toBe(1);
      expect(boss(pickBoss(8, r)).finisher).toBe(true);
      expect(boss(pickBoss(5, r)).finisher).toBeUndefined();
    }
  });
});

describe('boss effects', () => {
  it('The Wall doubles and Velvet Rope triples the target', () => {
    expect(atBoss('wall', 2).target).toBe(1600 * 2);
    expect(atBoss('velvetRope', 8).target).toBe(100000 * 3);
    expect(atBoss('flint', 2).target).toBe(1600);
  });

  it('The Drought halves rerolls', () => {
    expect(atBoss('drought').rerollsLeft).toBe(5);
  });

  it('Rusted Lock keeps 2 dice from rerolling', () => {
    const s = atBoss('rustedLock', 8);
    expect(s.locked).toHaveLength(2);
    const before = s.shown.slice();
    let st = s;
    for (let i = 0; i < 5; i++) st = apply(st, { t: 'reroll', keep: [] }).state;
    for (const i of s.locked) expect(st.shown[i]).toBe(before[i]);
    const others = [0, 1, 2, 3, 4].filter((i) => !s.locked.includes(i));
    expect(() => apply(s, { t: 'reroll', keep: others })).toThrow(/nothing/);
  });

  it('debuffed dice form combos but add nothing', () => {
    const s = fixed([3, 3, 4, 1, 1]);
    Object.assign(s, { blind: 'boss', boss: 'oddOne' });
    addJoker(s, 'oddDuck');
    addJoker(s, 'croupier');
    const r = scoreHand(s, [0, 1]);
    expect(r.combo).toBe('pair');
    expect(r.total).toBe(10 * (2 + 4)); // base chips only; Odd Duck never fires; Croupier still does
  });

  it('The Even One debuffs Wild faces too', () => {
    const s = fixed([[4, 'wild'], 1, 1, 1, 1]);
    Object.assign(s, { blind: 'boss', boss: 'evenOne' });
    expect(scoreHand(s, [0]).total).toBe(5);
  });

  it('The Flint halves base chips and mult', () => {
    const s = fixed([10, 10, 10, 10, 10]);
    Object.assign(s, { blind: 'boss', boss: 'flint' });
    expect(scoreHand(s, [0, 1, 2, 3, 4]).total).toBe((50 + 50) * 5);
  });

  it('The Spindle debuffs thin dice', () => {
    const s = fixed([9, 1, 1, 1, 1]); // fixed() dice have 1 face each
    Object.assign(s, { blind: 'boss', boss: 'spindle' });
    expect(scoreHand(s, [0]).total).toBe(5);
  });

  it('boss effects only apply on the boss blind', () => {
    const s = fixed([3, 3, 4, 1, 1]);
    Object.assign(s, { blind: 'big', boss: 'oddOne' });
    expect(scoreHand(s, [0, 1]).total).toBe(16 * 2);
  });
});
