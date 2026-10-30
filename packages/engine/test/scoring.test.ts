import { describe, expect, it } from 'vitest';
import { addJoker } from '../src/run';
import { scoreHand } from '../src/scoring';
import { fixed } from './helpers';

describe('base scoring', () => {
  it('scores a pair with the kicker contributing nothing', () => {
    const r = scoreHand(fixed([2, 2, 3, 9, 9]), [0, 1, 2]);
    expect(r).toMatchObject({ combo: 'pair', scored: [0, 1], chips: 14, mult: 2, total: 28 });
    expect(r.steps).toEqual([
      { t: 'base', combo: 'pair', chips: 10, mult: 2 },
      { t: 'fx', src: 'face', die: 0, chips: 2 },
      { t: 'fx', src: 'face', die: 1, chips: 2 },
    ]);
  });

  it('applies combo levels', () => {
    const s = fixed([2, 2, 3, 9, 9]);
    s.levels.pair = 2;
    expect(scoreHand(s, [0, 1, 2]).total).toBe((25 + 4) * 3);
  });

  it('scores five of a kind', () => {
    expect(scoreHand(fixed([10, 10, 10, 10, 10]), [0, 1, 2, 3, 4]).total).toBe(1500);
  });
});

describe('stickers', () => {
  it('Bonus, Mult, Glass', () => {
    expect(scoreHand(fixed([[5, 'bonus'], 1, 1, 1, 1]), [0]).total).toBe(5 + 5 + 30);
    expect(scoreHand(fixed([[5, 'mult'], 1, 1, 1, 1]), [0]).total).toBe((5 + 5) * 5);
    expect(scoreHand(fixed([[5, 'glass'], 1, 1, 1, 1]), [0]).total).toBe(10 * 2);
  });

  it('Steel triggers only when the die is not selected', () => {
    expect(scoreHand(fixed([5, [7, 'steel'], 1, 1, 1]), [0]).total).toBe(15);
    expect(scoreHand(fixed([5, [7, 'steel'], 1, 1, 1]), [0, 1]).total).toBe(12);
  });

  it('Stone adds 50 chips and never pairs', () => {
    expect(scoreHand(fixed([[3, 'stone'], 4, 4, 1, 1]), [0, 1, 2]).total).toBe((10 + 8 + 50) * 2);
  });

  it('Wild counts for parity', () => {
    expect(scoreHand(fixed([1, 3, [4, 'wild'], 7, 9]), [0, 1, 2, 3, 4]).total).toBe((20 + 1 + 3 + 4 + 7 + 9) * 2);
  });

  it('Lucky triggers about 1 in 5', () => {
    const s = fixed([[5, 'lucky'], 1, 1, 1, 1]);
    let hits = 0;
    for (let i = 0; i < 500; i++) hits += scoreHand(s, [0]).steps.filter((x) => x.t === 'fx' && x.src === 'lucky' && x.mult).length;
    expect(hits).toBeGreaterThan(60);
    expect(hits).toBeLessThan(140);
  });

  it('Glass eventually loses its sticker but keeps the face', () => {
    const s = fixed([[5, 'glass'], 1, 1, 1, 1]);
    for (let i = 0; i < 100 && s.dice[0].faces[0].sticker; i++) scoreHand(s, [0]);
    expect(s.dice[0].faces).toEqual([{ id: 'd0x', value: 5 }]);
  });
});

describe('jokers', () => {
  it('Croupier and Twin Dice add mult', () => {
    const s = fixed([2, 2, 3, 9, 9]);
    addJoker(s, 'croupier');
    addJoker(s, 'twinDice');
    expect(scoreHand(s, [0, 1]).total).toBe(14 * (2 + 4 + 8));
  });

  it('joker order matters', () => {
    const a = fixed([2, 2, 1, 1, 9]);
    addJoker(a, 'croupier');
    addJoker(a, 'doubleDown');
    expect(scoreHand(a, [0, 1]).total).toBe(14 * ((2 + 4) * 2));
    const b = fixed([2, 2, 1, 1, 9]);
    addJoker(b, 'doubleDown');
    addJoker(b, 'croupier');
    expect(scoreHand(b, [0, 1]).total).toBe(14 * (2 * 2 + 4));
  });

  it('Odd Duck and Even Keel both fire on a Wild face', () => {
    const s = fixed([[4, 'wild'], 1, 1, 1, 1]);
    addJoker(s, 'oddDuck');
    addJoker(s, 'evenKeel');
    expect(scoreHand(s, [0]).total).toBe((5 + 4 + 31) * (1 + 4));
  });

  it('Rerun retriggers low faces; Last Call retriggers on the last hand', () => {
    const r = fixed([3, 1, 1, 1, 1]);
    addJoker(r, 'rerun');
    expect(scoreHand(r, [0]).total).toBe(5 + 3 + 3);
    const l = fixed([9, 1, 1, 1, 1]);
    addJoker(l, 'lastCall');
    expect(scoreHand(l, [0]).total).toBe(5 + 9);
    l.handsLeft = 1;
    expect(scoreHand(l, [0]).total).toBe(5 + 9 + 9);
  });

  it('Unspent Luck and Last Roll read the reroll pool', () => {
    const s = fixed([9, 1, 1, 1, 1]);
    addJoker(s, 'unspentLuck');
    addJoker(s, 'lastRoll');
    expect(scoreHand(s, [0]).total).toBe(5 + 9 + 150);
    s.rerollsLeft = 0;
    expect(scoreHand(s, [0]).total).toBe((5 + 9) * 16);
  });

  it('Hot Streak grows per hand; Encore counts the combo', () => {
    const s = fixed([9, 1, 1, 1, 1]);
    addJoker(s, 'hotStreak');
    addJoker(s, 'encore');
    expect(scoreHand(s, [0]).total).toBe(14 * (1 + 1 + 1));
    expect(scoreHand(s, [0]).total).toBe(14 * (1 + 2 + 2));
  });

  it('High Roller, Snake Eyes, Golden Ratio, Ten-Four', () => {
    const s = fixed([10, 1, 8, 4, 2]);
    addJoker(s, 'highRoller');
    expect(scoreHand(s, [0]).total).toBe(5 + 10 + 30);
    const e = fixed([1, 2, 2, 2, 2]);
    addJoker(e, 'snakeEyes');
    expect(scoreHand(e, [0]).total).toBe((5 + 1 + 20) * 5);
    const g = fixed([8, 2, 2, 2, 2]);
    addJoker(g, 'goldenRatio');
    expect(scoreHand(g, [0]).total).toBe(13 * 9);
    const t = fixed([4, 2, 2, 2, 2]);
    addJoker(t, 'tenFour');
    expect(scoreHand(t, [0]).total).toBe((5 + 4 + 10) * 5);
  });

  it('Short Ladder changes detection', () => {
    const s = fixed([2, 3, 4, 5, 9]);
    addJoker(s, 'shortLadder');
    expect(scoreHand(s, [0, 1, 2, 3]).combo).toBe('largeStraight');
  });
});
