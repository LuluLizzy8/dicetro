import { describe, expect, it } from 'vitest';
import { InvalidAction } from '../src/errors';
import { JOKER_IDS } from '../src/jokers';
import { addJoker, apply, newRun, type RunState } from '../src/run';
import { itemCost, openShop, PACK_COST } from '../src/shop';

function inShop(seed = 'shop', money = 50): RunState {
  const s = newRun(seed);
  s.money = money;
  openShop(s);
  return s;
}

describe('shop', () => {
  it('stocks 2 items and 2 packs, deterministically per seed', () => {
    const a = inShop();
    expect(a.shop!.items).toHaveLength(2);
    expect(a.shop!.packs).toHaveLength(2);
    expect(inShop().shop).toEqual(a.shop);
  });

  it('buying an item charges its cost and empties the slot', () => {
    const s = inShop();
    const it = s.shop!.items[0]!;
    const r = apply(s, { t: 'buy', what: 'item', slot: 0 }).state;
    expect(r.money).toBe(50 - itemCost(it));
    expect(r.shop!.items[0]).toBeNull();
    expect(r.jokers.length + r.consumables.length).toBe(1);
    expect(() => apply(r, { t: 'buy', what: 'item', slot: 0 })).toThrow(InvalidAction);
  });

  it('refuses purchases without money or a free slot', () => {
    expect(() => apply(inShop('shop', 0), { t: 'buy', what: 'item', slot: 0 })).toThrow(InvalidAction);
    const full = inShop();
    full.shop!.items[0] = { kind: 'joker', id: 'croupier' };
    for (let i = 0; i < 5; i++) addJoker(full, 'goldTooth');
    expect(() => apply(full, { t: 'buy', what: 'item', slot: 0 })).toThrow(/slot/);
  });

  it('shop reroll costs $5 then $6', () => {
    const s = inShop();
    const a = apply(s, { t: 'rerollShop' }).state;
    const b = apply(a, { t: 'rerollShop' }).state;
    expect([a.money, b.money]).toEqual([45, 39]);
  });

  it('never offers a Joker you already own', () => {
    const s = newRun('dupes');
    s.money = 1e6;
    for (const id of JOKER_IDS.slice(0, 5)) addJoker(s, id);
    openShop(s);
    let st = s;
    for (let i = 0; i < 40; i++) {
      for (const it of st.shop!.items) if (it?.kind === 'joker') expect(JOKER_IDS.slice(0, 5)).not.toContain(it.id);
      st = apply(st, { t: 'rerollShop' }).state;
    }
  });
});

describe('packs', () => {
  function openPack(kind: 'dice' | 'tarot' | 'weight') {
    const s = inShop();
    s.shop!.packs[0] = kind;
    return apply(s, { t: 'buy', what: 'pack', slot: 0 }).state;
  }

  it('dice pack swaps the chosen die', () => {
    const s = openPack('dice');
    expect(s.phase).toBe('pack');
    expect(s.money).toBe(50 - PACK_COST);
    const option = s.pack!.options[1];
    expect(() => apply(s, { t: 'pick', index: 1 })).toThrow(/replace/);
    const r = apply(s, { t: 'pick', index: 1, replace: 2 }).state;
    expect(option.kind === 'die' && r.dice[2]).toEqual(option.kind === 'die' && option.die);
    expect(r.phase).toBe('shop');
    expect(r.pack).toBeNull();
  });

  it('weight pack levels the chosen combo', () => {
    const s = openPack('weight');
    const o = s.pack!.options[0];
    const r = apply(s, { t: 'pick', index: 0 }).state;
    expect(o.kind === 'weight' && r.levels[o.combo]).toBe(2);
  });

  it('tarot pack uses the tarot on the target', () => {
    const s = openPack('tarot');
    s.pack!.options[0] = { kind: 'tarot', id: 'chisel' };
    const r = apply(s, { t: 'pick', index: 0, target: { faces: [s.dice[0].faces[0].id] } }).state;
    expect(r.dice[0].faces).toHaveLength(9);
  });

  it('skipping returns to the shop', () => {
    expect(apply(openPack('dice'), { t: 'skipPack' }).state.phase).toBe('shop');
  });
});
