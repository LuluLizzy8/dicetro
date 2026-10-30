import { describe, expect, it } from 'vitest';
import { useConsumable, type TarotId } from '../src/consumables';
import { InvalidAction } from '../src/errors';
import { newRun, type RunState } from '../src/run';

function withTarot(id: TarotId): RunState {
  const s = newRun('tarot');
  s.consumables.push({ kind: 'tarot', id });
  return s;
}
const fid = (s: RunState, d: number, f: number) => s.dice[d].faces[f].id;

describe('tarots', () => {
  it('Chisel removes a face, down to 1', () => {
    const s = withTarot('chisel');
    const id = fid(s, 0, 3);
    useConsumable(s, 0, { faces: [id] });
    expect(s.dice[0].faces).toHaveLength(9);
    expect(s.dice[0].faces.some((f) => f.id === id)).toBe(false);
    expect(s.consumables).toHaveLength(0);

    const one = withTarot('chisel');
    one.dice[0].faces = [one.dice[0].faces[0]];
    one.shown[0] = one.dice[0].faces[0].id;
    expect(() => useConsumable(one, 0, { faces: [fid(one, 0, 0)] })).toThrow(InvalidAction);
  });

  it('Chisel on the showing face rerolls that die', () => {
    const s = withTarot('chisel');
    const shown = s.shown[0];
    useConsumable(s, 0, { faces: [shown] });
    expect(s.dice[0].faces.some((f) => f.id === s.shown[0])).toBe(true);
  });

  it('Shatter removes 2 random faces', () => {
    const s = withTarot('shatter');
    useConsumable(s, 0, { faces: [fid(s, 2, 0)] });
    expect(s.dice[2].faces).toHaveLength(8);
  });

  it('Mold copies value and sticker on the same die only', () => {
    const s = withTarot('mold');
    s.dice[0].faces[9].sticker = 'glass';
    useConsumable(s, 0, { faces: [fid(s, 0, 0), fid(s, 0, 9)] });
    expect(s.dice[0].faces[0]).toMatchObject({ value: 10, sticker: 'glass' });
    const bad = withTarot('mold');
    expect(() => useConsumable(bad, 0, { faces: [fid(bad, 0, 0), fid(bad, 1, 9)] })).toThrow(InvalidAction);
  });

  it('Forge caps at 10; Sun and Moon fix parity', () => {
    const s = withTarot('forge');
    useConsumable(s, 0, { faces: [fid(s, 0, 0), fid(s, 0, 9)] });
    expect([s.dice[0].faces[0].value, s.dice[0].faces[9].value]).toEqual([2, 10]);
    const sun = withTarot('sun');
    useConsumable(sun, 0, { faces: [fid(sun, 0, 0), fid(sun, 0, 1)] });
    expect([sun.dice[0].faces[0].value, sun.dice[0].faces[1].value]).toEqual([2, 2]);
    const moon = withTarot('moon');
    useConsumable(moon, 0, { faces: [fid(moon, 0, 0), fid(moon, 0, 1)] });
    expect([moon.dice[0].faces[0].value, moon.dice[0].faces[1].value]).toEqual([1, 1]);
  });

  it('Mirror adds a copy with a new id', () => {
    const s = withTarot('mirror');
    useConsumable(s, 0, { faces: [fid(s, 1, 6)] });
    expect(s.dice[1].faces).toHaveLength(11);
    expect(s.dice[1].faces[10].value).toBe(7);
    expect(new Set(s.dice[1].faces.map((f) => f.id)).size).toBe(11);
  });

  it('Gilder stickers every face of the chosen value', () => {
    const s = withTarot('gildGlass');
    s.dice[0].faces[0].value = 5;
    useConsumable(s, 0, { faces: [fid(s, 0, 4)] });
    expect(s.dice[0].faces.filter((f) => f.sticker === 'glass').map((f) => f.id)).toEqual([fid(s, 0, 0), fid(s, 0, 4)]);
  });

  it('Hermit doubles money up to +$20', () => {
    const s = withTarot('hermit');
    useConsumable(s, 0);
    expect(s.money).toBe(8);
    const rich = withTarot('hermit');
    rich.money = 30;
    useConsumable(rich, 0);
    expect(rich.money).toBe(50);
  });

  it('rejects missing or bad targets', () => {
    const s = withTarot('chisel');
    expect(() => useConsumable(s, 0, {})).toThrow(InvalidAction);
    expect(() => useConsumable(s, 0, { faces: ['nope'] })).toThrow(InvalidAction);
    expect(() => useConsumable(s, 3)).toThrow(InvalidAction);
  });
});

it('Weights level up their combo', () => {
  const s = newRun('w');
  s.consumables.push({ kind: 'weight', combo: 'pair' });
  useConsumable(s, 0);
  expect(s.levels.pair).toBe(2);
});
