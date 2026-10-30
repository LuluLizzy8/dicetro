import { describe, expect, it } from 'vitest';
import { apply, InvalidAction, legalActions, newRun, values, type RunState } from '../src/run';

// Every die becomes a single face of `v`, so rolls are fixed.
function fixDice(s: RunState, v: number): RunState {
  s.dice = s.dice.map((d) => ({ ...d, faces: [{ id: `${d.id}x`, value: v }] }));
  s.shown = s.dice.map((d) => d.faces[0].id);
  return s;
}

describe('newRun', () => {
  it('is deterministic per seed', () => {
    expect(values(newRun('abc'))).toEqual(values(newRun('abc')));
  });

  it('starts at ante 1 small blind', () => {
    const s = newRun('abc');
    expect(s).toMatchObject({ phase: 'rolling', ante: 1, blind: 'small', target: 300, handsLeft: 4, rerollsLeft: 10, money: 4 });
    expect(values(s)).toHaveLength(5);
  });
});

describe('reroll', () => {
  it('keeps locked dice and spends one reroll without mutating input', () => {
    const s = newRun('abc');
    const before = JSON.stringify(s);
    const { state, events } = apply(s, { t: 'reroll', keep: [0, 1] });
    expect(values(state).slice(0, 2)).toEqual(values(s).slice(0, 2));
    expect(state.rerollsLeft).toBe(9);
    expect(events[0].t).toBe('rolled');
    expect(JSON.stringify(s)).toBe(before);
  });

  it.each([[[0, 1, 2, 3, 4]], [[0, 0]], [[5]], [[-1]]])('rejects keep %j', (keep) => {
    expect(() => apply(newRun('abc'), { t: 'reroll', keep })).toThrow(InvalidAction);
  });

  it('rejects reroll with an empty pool', () => {
    const s = newRun('abc');
    s.rerollsLeft = 0;
    expect(legalActions(s)).toEqual(['score']);
    expect(() => apply(s, { t: 'reroll', keep: [] })).toThrow(InvalidAction);
  });
});

describe('score', () => {
  it('uses a hand, adds score, and rolls a fresh hand', () => {
    const s = newRun('abc');
    s.target = 1e9;
    const { state, events } = apply(s, { t: 'score', dice: [0] });
    expect(state.handsLeft).toBe(3);
    expect(state.score).toBeGreaterThan(0);
    expect(events.map((e) => e.t)).toEqual(['scored', 'rolled']);
  });

  it('maps scored indices back to dice', () => {
    const s = fixDice(newRun('abc'), 4);
    s.target = 1e9;
    const { events } = apply(s, { t: 'score', dice: [3, 1] });
    expect(events[0]).toMatchObject({ t: 'scored', combo: 'pair', dice: [1, 3], scored: [1, 3] });
  });

  it.each([[[]], [[0, 0]], [[5]]])('rejects dice %j', (dice) => {
    expect(() => apply(newRun('abc'), { t: 'score', dice })).toThrow(InvalidAction);
  });

  it('loses after the last hand misses the target', () => {
    let s = newRun('abc');
    s.target = 1e9;
    for (let i = 0; i < 4; i++) s = apply(s, { t: 'score', dice: [0] }).state;
    expect(s.phase).toBe('lost');
    expect(legalActions(s)).toEqual([]);
  });
});

describe('blind flow', () => {
  it('clears a blind, cashes out, and moves to the big blind', () => {
    const s = fixDice(newRun('abc'), 10);
    const r = apply(s, { t: 'score', dice: [0, 1, 2, 3, 4] });
    expect(r.state.score).toBe(1500);
    expect(r.state.phase).toBe('cleared');
    expect(r.state.money).toBe(4 + 3 + 3 + 0); // start + reward + 3 unused hands + interest
    const n = apply(r.state, { t: 'next' }).state;
    expect(n).toMatchObject({ phase: 'rolling', ante: 1, blind: 'big', target: 400, score: 0, handsLeft: 4, rerollsLeft: 10 });
  });

  it('wins at the ante 8 boss and continues into endless', () => {
    const s = newRun('abc');
    Object.assign(s, { ante: 8, blind: 'boss', target: 1 });
    const won = apply(s, { t: 'score', dice: [0] }).state;
    expect(won.phase).toBe('won');
    expect(legalActions(won)).toEqual(['endless']);
    const e = apply(won, { t: 'endless' }).state;
    expect(e).toMatchObject({ phase: 'rolling', ante: 9, blind: 'small', endless: true });
  });

  it('rejects actions from the wrong phase', () => {
    expect(() => apply(newRun('abc'), { t: 'next' })).toThrow(InvalidAction);
  });
});
