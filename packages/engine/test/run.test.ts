import { describe, expect, it } from 'vitest';
import { joker } from '../src/jokers';
import { addConsumable, addJoker, apply, InvalidAction, legalActions, newRun, values, type RunState } from '../src/run';

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
    const shop = apply(r.state, { t: 'next' }).state;
    expect(shop.phase).toBe('shop');
    const n = apply(shop, { t: 'next' }).state;
    expect(n).toMatchObject({ phase: 'rolling', ante: 1, blind: 'big', target: 400, score: 0, handsLeft: 4, rerollsLeft: 10, shop: null });
  });

  it('wins at the ante 8 boss and continues into endless', () => {
    const s = newRun('abc');
    Object.assign(s, { ante: 8, blind: 'boss', boss: 'velvetRope', target: 1 });
    const won = apply(s, { t: 'score', dice: [0] }).state;
    expect(won.phase).toBe('won');
    expect(legalActions(won)).toEqual(['endless']);
    const shop = apply(won, { t: 'endless' }).state;
    expect(shop).toMatchObject({ phase: 'shop', endless: true });
    expect(apply(shop, { t: 'next' }).state).toMatchObject({ phase: 'rolling', ante: 9, blind: 'small' });
  });

  it('rejects actions from the wrong phase', () => {
    expect(() => apply(newRun('abc'), { t: 'next' })).toThrow(InvalidAction);
  });
});

describe('jokers and consumables in a run', () => {
  it('limits joker and consumable slots', () => {
    const s = newRun('slots');
    for (let i = 0; i < 5; i++) expect(addJoker(s, 'croupier')).toBe(true);
    expect(addJoker(s, 'croupier')).toBe(false);
    expect(addConsumable(s, { kind: 'tarot', id: 'hermit' })).toBe(true);
    expect(addConsumable(s, { kind: 'tarot', id: 'hermit' })).toBe(true);
    expect(addConsumable(s, { kind: 'tarot', id: 'hermit' })).toBe(false);
  });

  it('sells for half cost (min $1) and reorders jokers', () => {
    const s = newRun('sell');
    addJoker(s, 'croupier');
    addJoker(s, 'doubleDown');
    const moved = apply(s, { t: 'moveJoker', from: 1, to: 0 }).state;
    expect(moved.jokers.map((j) => j.id)).toEqual(['doubleDown', 'croupier']);
    const sold = apply(moved, { t: 'sell', what: 'joker', index: 0 });
    expect(sold.state.money).toBe(4 + 4);
    expect(sold.events).toEqual([{ t: 'sold', name: 'Double Down', money: 4 }]);
    expect(apply(sold.state, { t: 'sell', what: 'joker', index: 0 }).state.money).toBe(8 + 1);
  });

  it('uses a consumable through apply', () => {
    const s = newRun('use');
    addConsumable(s, { kind: 'weight', combo: 'pair' });
    const r = apply(s, { t: 'use', slot: 0 });
    expect(r.state.levels.pair).toBe(2);
    expect(r.events).toEqual([{ t: 'used', name: 'Pair Weight' }]);
  });

  it('pays Gold faces left unplayed and Gold Tooth at cash-out', () => {
    const s = fixDice(newRun('gold'), 10);
    s.dice[4].faces[0].sticker = 'gold';
    addJoker(s, 'goldTooth');
    const r = apply(s, { t: 'score', dice: [0, 1, 2, 3] });
    expect(r.state.phase).toBe('cleared');
    expect(r.events.find((e) => e.t === 'cashOut')).toMatchObject({ extra: 3 + 4 });
  });

  it("Rabbit's Foot breaks about 1 in 6 rounds", () => {
    const s = newRun('rabbit');
    addJoker(s, 'rabbitFoot');
    let broke = 0;
    for (let i = 0; i < 600; i++) if (joker('rabbitFoot').onRoundEnd!(s.jokers[0], s)?.destroy) broke++;
    expect(broke).toBeGreaterThan(60);
    expect(broke).toBeLessThan(140);
  });

  it('Hot Streak loses 1 per reroll', () => {
    const s = newRun('hot');
    addJoker(s, 'hotStreak');
    s.jokers[0].state.n = 3;
    expect(apply(s, { t: 'reroll', keep: [] }).state.jokers[0].state.n).toBe(2);
  });
});
