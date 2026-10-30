import type { Combo, Rules } from './combos';
import { isEven, isOdd, rank, type Face } from './dice';
import { int } from './rng';
import type { RunState } from './run';

export type Fx = { chips?: number; mult?: number; xmult?: number; money?: number };
/** What a Joker sees while a hand scores. `last` = this is the blind's last remaining hand. */
export type Ctx = { s: RunState; combo: Combo; scored: number[]; last: boolean };
export type Rarity = 'common' | 'uncommon' | 'rare';
export type JokerInst = { id: JokerId; uid: string; state: { n: number } };

export type JokerDef = {
  name: string;
  text: string;
  inspiredBy: string; // internal reference only, never shown in game
  rarity: Rarity;
  cost: number;
  rules?: (r: Rules) => void;
  onScoreStart?: (j: JokerInst, c: Ctx) => void;
  onDie?: (j: JokerInst, c: Ctx, f: Face) => Fx | null;
  retrigger?: (j: JokerInst, c: Ctx, f: Face) => number;
  onJoker?: (j: JokerInst, c: Ctx) => Fx | null;
  onReroll?: (j: JokerInst) => void;
  onRoundEnd?: (j: JokerInst, s: RunState) => { money?: number; destroy?: boolean } | null;
};

/** Which combos "contain" a Pair / Three of a Kind / Straight (design §11.2 #1). */
export const CONTAINS: Record<'pair' | 'threeKind' | 'straight', Combo[]> = {
  pair: ['pair', 'twoPair', 'threeKind', 'fullHouse', 'parityHouse', 'fourKind', 'fiveKind'],
  threeKind: ['threeKind', 'fullHouse', 'parityHouse', 'fourKind', 'fiveKind'],
  straight: ['smallStraight', 'largeStraight'],
};

const ifCombo = (k: keyof typeof CONTAINS, fx: Fx) => (_j: JokerInst, c: Ctx) => (CONTAINS[k].includes(c.combo) ? fx : null);
const ifFace = (pred: (f: Face) => boolean, fx: Fx) => (_j: JokerInst, _c: Ctx, f: Face) => (pred(f) ? fx : null);

export const JOKERS = {
  croupier: { name: 'Croupier', text: '+4 Mult', inspiredBy: 'Joker', rarity: 'common', cost: 2, onJoker: () => ({ mult: 4 }) },
  twinDice: { name: 'Twin Dice', text: '+8 Mult if the combo contains a Pair', inspiredBy: 'Jolly Joker', rarity: 'common', cost: 3, onJoker: ifCombo('pair', { mult: 8 }) },
  tripleThreat: { name: 'Triple Threat', text: '+12 Mult if the combo contains Three of a Kind', inspiredBy: 'Zany Joker', rarity: 'common', cost: 4, onJoker: ifCombo('threeKind', { mult: 12 }) },
  ladderClimber: { name: 'Ladder Climber', text: '+12 Mult if the combo is a Straight', inspiredBy: 'Crazy Joker', rarity: 'common', cost: 4, onJoker: ifCombo('straight', { mult: 12 }) },
  parityBit: {
    name: 'Parity Bit', text: '+10 Mult if the combo is Parity or Parity House', inspiredBy: 'Droll Joker', rarity: 'common', cost: 4,
    onJoker: (_j, c) => (c.combo === 'parity' || c.combo === 'parityHouse' ? { mult: 10 } : null),
  },
  doubleDown: { name: 'Double Down', text: 'x2 Mult if the combo contains a Pair', inspiredBy: 'The Duo', rarity: 'rare', cost: 8, onJoker: ifCombo('pair', { xmult: 2 }) },
  oddDuck: { name: 'Odd Duck', text: 'Scored odd faces give +31 Chips', inspiredBy: 'Odd Todd', rarity: 'common', cost: 4, onDie: ifFace(isOdd, { chips: 31 }) },
  evenKeel: { name: 'Even Keel', text: 'Scored even faces give +4 Mult', inspiredBy: 'Even Steven', rarity: 'common', cost: 4, onDie: ifFace(isEven, { mult: 4 }) },
  goldenRatio: {
    name: 'Golden Ratio', text: 'Scored 1, 2, 3, 5 or 8 give +8 Mult', inspiredBy: 'Fibonacci', rarity: 'uncommon', cost: 6,
    onDie: ifFace((f) => [1, 2, 3, 5, 8].includes(rank(f)), { mult: 8 }),
  },
  tenFour: { name: 'Ten-Four', text: 'Scored 10s and 4s give +10 Chips and +4 Mult', inspiredBy: 'Walkie Talkie', rarity: 'common', cost: 4, onDie: ifFace((f) => rank(f) === 10 || rank(f) === 4, { chips: 10, mult: 4 }) },
  highRoller: { name: 'High Roller', text: 'Scored faces of 8 or more give +30 Chips', inspiredBy: 'Scary Face', rarity: 'common', cost: 4, onDie: ifFace((f) => rank(f) >= 8, { chips: 30 }) },
  snakeEyes: { name: 'Snake Eyes', text: 'Scored 1s give +20 Chips and +4 Mult', inspiredBy: 'Scholar', rarity: 'common', cost: 4, onDie: ifFace((f) => rank(f) === 1, { chips: 20, mult: 4 }) },
  unspentLuck: {
    name: 'Unspent Luck', text: '+15 Chips per reroll left', inspiredBy: 'Banner', rarity: 'common', cost: 5,
    onJoker: (_j, c) => (c.s.rerollsLeft ? { chips: 15 * c.s.rerollsLeft } : null),
  },
  lastRoll: { name: 'Last Roll', text: '+15 Mult when no rerolls are left', inspiredBy: 'Mystic Summit', rarity: 'common', cost: 5, onJoker: (_j, c) => (c.s.rerollsLeft === 0 ? { mult: 15 } : null) },
  hotStreak: {
    name: 'Hot Streak', text: '+1 Mult per hand scored, -1 per reroll used', inspiredBy: 'Green Joker', rarity: 'common', cost: 4,
    onScoreStart: (j) => { j.state.n++; },
    onReroll: (j) => { j.state.n = Math.max(0, j.state.n - 1); },
    onJoker: (j) => (j.state.n ? { mult: j.state.n } : null),
  },
  encore: { name: 'Encore', text: '+Mult equal to times this combo was scored this run', inspiredBy: 'Supernova', rarity: 'uncommon', cost: 5, onJoker: (_j, c) => ({ mult: c.s.comboCounts[c.combo] }) },
  rerun: { name: 'Rerun', text: 'Retrigger scored 2, 3, 4 and 5', inspiredBy: 'Hack', rarity: 'uncommon', cost: 6, retrigger: (_j, _c, f) => ([2, 3, 4, 5].includes(rank(f)) ? 1 : 0) },
  lastCall: { name: 'Last Call', text: 'Retrigger every scored die on the last hand', inspiredBy: 'Dusk', rarity: 'uncommon', cost: 5, retrigger: (_j, c) => (c.last ? 1 : 0) },
  rabbitFoot: {
    name: "Lucky Rabbit's Foot", text: '+15 Mult. 1 in 6 chance to break at end of round', inspiredBy: 'Gros Michel', rarity: 'common', cost: 5,
    onJoker: () => ({ mult: 15 }),
    onRoundEnd: (_j, s) => (int(s.rng.joker, 6) === 0 ? { destroy: true } : null),
  },
  goldTooth: { name: 'Gold Tooth', text: '+$4 at end of round', inspiredBy: 'Golden Joker', rarity: 'common', cost: 6, onRoundEnd: () => ({ money: 4 }) },
  shortLadder: {
    name: 'Short Ladder', text: 'Large Straight and Parity need only 4 dice', inspiredBy: 'Four Fingers', rarity: 'uncommon', cost: 7,
    rules: (r) => { r.shortLadder = true; },
  },
} satisfies Record<string, JokerDef>;

export type JokerId = keyof typeof JOKERS;
export const JOKER_IDS = Object.keys(JOKERS) as JokerId[];
export const joker = (id: JokerId): JokerDef => JOKERS[id];
