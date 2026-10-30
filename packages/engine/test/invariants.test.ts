import { expect, it } from 'vitest';
import { int, makeRng } from '../src/rng';
import { apply, legalActions, newRun, type Action, type RunState } from '../src/run';

function check(s: RunState) {
  expect(s.handsLeft).toBeGreaterThanOrEqual(0);
  expect(s.handsLeft).toBeLessThanOrEqual(4);
  expect(s.rerollsLeft).toBeGreaterThanOrEqual(0);
  expect(s.rerollsLeft).toBeLessThanOrEqual(10);
  expect(s.score).toBeGreaterThanOrEqual(0);
  s.dice.forEach((d, i) => expect(d.faces.some((f) => f.id === s.shown[i])).toBe(true));
}

it('random legal play keeps invariants and ends in a loss', () => {
  for (let seed = 0; seed < 20; seed++) {
    const r = makeRng(String(seed), 'test-policy');
    let s = newRun(String(seed));
    let steps = 0;
    while (legalActions(s).length && steps < 2000) {
      const kinds = legalActions(s).filter((k): k is 'reroll' | 'score' | 'next' | 'endless' =>
        ['reroll', 'score', 'next', 'endless'].includes(k));
      const t = kinds[int(r, kinds.length)];
      const pick = () => [0, 1, 2, 3, 4].filter(() => int(r, 2) === 1);
      let a: Action;
      if (t === 'reroll') a = { t, keep: pick().slice(0, 4) };
      else if (t === 'score') { const d = pick(); a = { t, dice: d.length ? d : [0] }; }
      else a = { t };
      s = apply(s, a).state;
      check(s);
      steps++;
    }
    expect(s.phase).toBe('lost');
  }
});
