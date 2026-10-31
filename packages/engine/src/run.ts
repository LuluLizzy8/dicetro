import { REWARD, target, type BlindKind } from './blinds';
import { activeBoss, isDebuffed, pickBoss, type BossId } from './bosses';
import { COMBOS, type Combo } from './combos';
import { consumableInfo, useConsumable, type Consumable, type Target } from './consumables';
import { makeD10, shownFace, type Die } from './dice';
import { InvalidAction } from './errors';
import { sellValue } from './inventory';
import { joker, type JokerId, type JokerInst } from './jokers';
import { int, makeRng, sample, type Rng } from './rng';
import { scoreHand, startLevels, type Levels, type ScoreResult } from './scoring';
import { buy, closePack, openShop, pickFromPack, rerollShop, type Pack, type Shop } from './shop';

export { InvalidAction } from './errors';
export { addConsumable, addJoker, CONSUMABLE_SLOTS, JOKER_SLOTS, sellValue } from './inventory';

export const HANDS = 4;
export const REROLLS = 10;
export const WIN_ANTE = 8;
export const START_MONEY = 4;
const DICE = 5;

export type Phase = 'rolling' | 'cleared' | 'shop' | 'pack' | 'won' | 'lost';

/** Plain JSON: safe to save, clone, and send over the wire. */
export type RunState = {
  seed: string;
  phase: Phase;
  ante: number;
  blind: BlindKind;
  boss: BossId; // this ante's boss, known in advance
  target: number;
  score: number;
  handsLeft: number;
  rerollsLeft: number;
  money: number;
  endless: boolean;
  dice: Die[];
  shown: string[]; // face id showing on each die
  locked: number[]; // dice that can't be rerolled this blind (Rusted Lock)
  lastPlayed: number[]; // dice selected on the most recent hand (Gold needs the closing hand)
  levels: Levels;
  comboCounts: Record<Combo, number>;
  jokers: JokerInst[];
  consumables: Consumable[];
  shop: Shop | null;
  pack: Pack | null;
  uid: number; // counter for new ids (jokers, mirrored faces, pack dice)
  rng: { dice: Rng; lucky: Rng; glass: Rng; joker: Rng; tarot: Rng; shop: Rng; packs: Rng; boss: Rng };
};

export type Action =
  | { t: 'reroll'; keep: number[] } // die indices to lock; the rest are rerolled
  | { t: 'score'; dice: number[] } // die indices to play
  | { t: 'next' } // cleared -> shop, shop -> next blind
  | { t: 'endless' }
  | { t: 'use'; slot: number; target?: Target }
  | { t: 'sell'; what: 'joker' | 'consumable'; index: number }
  | { t: 'moveJoker'; from: number; to: number }
  | { t: 'buy'; what: 'item' | 'pack'; slot: number }
  | { t: 'rerollShop' }
  | { t: 'pick'; index: number; replace?: number; target?: Target }
  | { t: 'skipPack' };

export type Event =
  | { t: 'blindStart'; ante: number; blind: BlindKind; target: number }
  | { t: 'rolled'; values: number[] }
  | ({ t: 'scored'; dice: number[] } & ScoreResult)
  | { t: 'cashOut'; reward: number; handBonus: number; interest: number; extra: number }
  | { t: 'jokerDestroyed'; id: JokerId }
  | { t: 'used'; name: string }
  | { t: 'sold'; name: string; money: number }
  | { t: 'lost' }
  | { t: 'won' };

export function values(s: RunState): number[] {
  return s.dice.map((_, i) => shownFace(s, i).value);
}

export function newRun(seed: string): RunState {
  const stream = (name: string) => makeRng(seed, name);
  const rng = {
    dice: stream('dice'), lucky: stream('lucky'), glass: stream('glass'), joker: stream('joker'),
    tarot: stream('tarot'), shop: stream('shop'), packs: stream('packs'), boss: stream('boss'),
  };
  const s: RunState = {
    seed, phase: 'rolling', ante: 1, blind: 'small', boss: pickBoss(1, rng.boss), target: target(1, 'small'), score: 0,
    handsLeft: HANDS, rerollsLeft: REROLLS, money: START_MONEY, endless: false,
    dice: Array.from({ length: DICE }, (_, i) => makeD10(`d${i}`)),
    shown: [], locked: [], lastPlayed: [], levels: startLevels(),
    comboCounts: Object.fromEntries(COMBOS.map((c) => [c, 0])) as Record<Combo, number>,
    jokers: [], consumables: [], shop: null, pack: null, uid: 0, rng,
  };
  roll(s, []);
  return s;
}

export function legalActions(s: RunState): Action['t'][] {
  const manage: Action['t'][] = [
    ...(s.consumables.length ? ['use' as const] : []),
    ...(s.jokers.length || s.consumables.length ? ['sell' as const] : []),
    ...(s.jokers.length > 1 ? ['moveJoker' as const] : []),
  ];
  switch (s.phase) {
    case 'rolling': return [...(s.rerollsLeft > 0 ? ['reroll' as const] : []), 'score', ...manage];
    case 'cleared': return ['next', ...manage];
    case 'shop': return ['next', 'buy', 'rerollShop', ...manage];
    case 'pack': return ['pick', 'skipPack'];
    case 'won': return ['endless'];
    case 'lost': return [];
  }
}

export function apply(state: RunState, action: Action): { state: RunState; events: Event[] } {
  if (!legalActions(state).includes(action.t)) throw new InvalidAction(`${action.t} not allowed in phase ${state.phase}`);
  const s: RunState = JSON.parse(JSON.stringify(state));
  const events: Event[] = [];
  switch (action.t) {
    case 'reroll': {
      if (!validDice(action.keep)) throw new InvalidAction('keep must be distinct die indices');
      const keep = [...new Set([...action.keep, ...s.locked])];
      if (keep.length === DICE) throw new InvalidAction('nothing to reroll');
      s.rerollsLeft--;
      for (const j of s.jokers) joker(j.id).onReroll?.(j);
      roll(s, keep);
      events.push({ t: 'rolled', values: values(s) });
      break;
    }
    case 'score': {
      if (!validDice(action.dice) || action.dice.length === 0) throw new InvalidAction('select 1-5 distinct die indices');
      const sel = [...action.dice].sort((a, b) => a - b);
      const r = scoreHand(s, sel);
      s.score += r.total;
      s.handsLeft--;
      s.lastPlayed = sel;
      events.push({ t: 'scored', dice: sel, ...r });
      if (s.score >= s.target) cashOut(s, events);
      else if (s.handsLeft === 0) { s.phase = 'lost'; events.push({ t: 'lost' }); }
      else { roll(s, []); events.push({ t: 'rolled', values: values(s) }); }
      break;
    }
    case 'next':
      if (s.phase === 'cleared') openShop(s);
      else {
        s.shop = null;
        advance(s);
        startBlind(s, events);
      }
      break;
    case 'endless':
      s.endless = true;
      openShop(s);
      break;
    case 'use': {
      const c = s.consumables[action.slot];
      if (!c) throw new InvalidAction('no consumable in that slot');
      useConsumable(s, action.slot, action.target);
      events.push({ t: 'used', name: consumableInfo(c).name });
      break;
    }
    case 'sell': {
      const list = action.what === 'joker' ? s.jokers : s.consumables;
      const item = list[action.index];
      if (!item) throw new InvalidAction(`no ${action.what} at ${action.index}`);
      const info = 'kind' in item ? consumableInfo(item) : joker(item.id);
      list.splice(action.index, 1);
      const money = sellValue(info.cost);
      s.money += money;
      events.push({ t: 'sold', name: info.name, money });
      break;
    }
    case 'moveJoker': {
      const { from, to } = action;
      const ok = (i: number) => Number.isInteger(i) && i >= 0 && i < s.jokers.length;
      if (!ok(from) || !ok(to)) throw new InvalidAction('joker index out of range');
      s.jokers.splice(to, 0, ...s.jokers.splice(from, 1));
      break;
    }
    case 'buy':
      buy(s, action.what, action.slot);
      break;
    case 'rerollShop':
      rerollShop(s);
      break;
    case 'pick':
      pickFromPack(s, action.index, action.replace, action.target);
      break;
    case 'skipPack':
      closePack(s);
      break;
  }
  return { state: s, events };
}

function validDice(xs: number[]): boolean {
  return Array.isArray(xs) && xs.every((i) => Number.isInteger(i) && i >= 0 && i < DICE) && new Set(xs).size === xs.length;
}

function roll(s: RunState, keep: number[]) {
  s.dice.forEach((d, i) => {
    if (!keep.includes(i)) s.shown[i] = d.faces[int(s.rng.dice, d.faces.length)].id;
  });
}

function startBlind(s: RunState, events: Event[]) {
  const b = activeBoss(s);
  const mult = b === 'wall' ? 2 : b === 'velvetRope' ? 3 : 1;
  Object.assign(s, {
    phase: 'rolling',
    target: target(s.ante, s.blind) * mult,
    score: 0,
    handsLeft: HANDS,
    rerollsLeft: b === 'drought' ? Math.floor(REROLLS / 2) : REROLLS,
    locked: b === 'rustedLock' ? sample(s.rng.boss, [0, 1, 2, 3, 4], 2).sort((x, y) => x - y) : [],
    lastPlayed: [],
  });
  events.push({ t: 'blindStart', ante: s.ante, blind: s.blind, target: s.target });
  roll(s, []);
  events.push({ t: 'rolled', values: values(s) });
}

function cashOut(s: RunState, events: Event[]) {
  const reward = REWARD[s.blind];
  const handBonus = s.handsLeft;
  const interest = Math.min(5, Math.floor(s.money / 5)); // on money held before payout
  let extra = 0;
  s.dice.forEach((_, i) => {
    if (!s.lastPlayed.includes(i) && !isDebuffed(s, i) && shownFace(s, i).sticker === 'gold') extra += 3;
  });
  for (const j of [...s.jokers]) {
    const r = joker(j.id).onRoundEnd?.(j, s);
    extra += r?.money ?? 0;
    if (r?.destroy) {
      s.jokers = s.jokers.filter((x) => x.uid !== j.uid);
      events.push({ t: 'jokerDestroyed', id: j.id });
    }
  }
  s.money += reward + handBonus + interest + extra;
  s.locked = [];
  events.push({ t: 'cashOut', reward, handBonus, interest, extra });
  if (s.blind === 'boss' && s.ante === WIN_ANTE && !s.endless) {
    s.phase = 'won';
    events.push({ t: 'won' });
  } else s.phase = 'cleared';
}

function advance(s: RunState) {
  if (s.blind === 'small') s.blind = 'big';
  else if (s.blind === 'big') s.blind = 'boss';
  else {
    s.blind = 'small';
    s.ante++;
    s.boss = pickBoss(s.ante, s.rng.boss);
  }
}
