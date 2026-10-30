import { REWARD, target, type BlindKind } from './blinds';
import { makeD10, type Die } from './dice';
import { int, makeRng, type Rng } from './rng';
import { scoreHand, startLevels, type Levels, type ScoreResult } from './scoring';

export const HANDS = 4;
export const REROLLS = 10;
export const WIN_ANTE = 8;
export const START_MONEY = 4;
const DICE = 5;

export type Phase = 'rolling' | 'cleared' | 'won' | 'lost';

/** Plain JSON: safe to save, clone, and send over the wire. */
export type RunState = {
  seed: string;
  phase: Phase;
  ante: number;
  blind: BlindKind;
  target: number;
  score: number;
  handsLeft: number;
  rerollsLeft: number;
  money: number;
  endless: boolean;
  dice: Die[];
  shown: string[]; // face id showing on each die
  levels: Levels;
  rng: { dice: Rng };
};

export type Action =
  | { t: 'reroll'; keep: number[] } // die indices to lock; the rest are rerolled
  | { t: 'score'; dice: number[] } // die indices to play
  | { t: 'next' }
  | { t: 'endless' };

export type Event =
  | { t: 'blindStart'; ante: number; blind: BlindKind; target: number }
  | { t: 'rolled'; values: number[] }
  | ({ t: 'scored'; dice: number[] } & ScoreResult)
  | { t: 'cashOut'; reward: number; handBonus: number; interest: number }
  | { t: 'lost' }
  | { t: 'won' };

export class InvalidAction extends Error {}

export function values(s: RunState): number[] {
  return s.dice.map((d, i) => d.faces.find((f) => f.id === s.shown[i])!.value);
}

export function newRun(seed: string): RunState {
  const s: RunState = {
    seed, phase: 'rolling', ante: 1, blind: 'small', target: target(1, 'small'), score: 0,
    handsLeft: HANDS, rerollsLeft: REROLLS, money: START_MONEY, endless: false,
    dice: Array.from({ length: DICE }, (_, i) => makeD10(`d${i}`)),
    shown: [], levels: startLevels(), rng: { dice: makeRng(seed, 'dice') },
  };
  roll(s, []);
  return s;
}

export function legalActions(s: RunState): Action['t'][] {
  switch (s.phase) {
    case 'rolling': return s.rerollsLeft > 0 ? ['reroll', 'score'] : ['score'];
    case 'cleared': return ['next'];
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
      if (!validDice(action.keep) || action.keep.length === DICE) throw new InvalidAction('keep must be 0-4 distinct die indices');
      s.rerollsLeft--;
      roll(s, action.keep);
      events.push({ t: 'rolled', values: values(s) });
      break;
    }
    case 'score': {
      if (!validDice(action.dice) || action.dice.length === 0) throw new InvalidAction('select 1-5 distinct die indices');
      const sel = [...action.dice].sort((a, b) => a - b);
      const v = values(s);
      const r = scoreHand(sel.map((i) => v[i]), s.levels);
      s.score += r.total;
      s.handsLeft--;
      events.push({
        t: 'scored', dice: sel, ...r,
        scored: r.scored.map((j) => sel[j]),
        steps: r.steps.map((st) => (st.t === 'die' ? { ...st, index: sel[st.index] } : st)),
      });
      if (s.score >= s.target) cashOut(s, events);
      else if (s.handsLeft === 0) { s.phase = 'lost'; events.push({ t: 'lost' }); }
      else { roll(s, []); events.push({ t: 'rolled', values: values(s) }); }
      break;
    }
    case 'next':
      advance(s);
      startBlind(s, events);
      break;
    case 'endless':
      s.endless = true;
      advance(s);
      startBlind(s, events);
      break;
  }
  return { state: s, events };
}

function validDice(xs: number[]): boolean {
  return xs.every((i) => Number.isInteger(i) && i >= 0 && i < DICE) && new Set(xs).size === xs.length;
}

function roll(s: RunState, keep: number[]) {
  s.dice.forEach((d, i) => {
    if (!keep.includes(i)) s.shown[i] = d.faces[int(s.rng.dice, d.faces.length)].id;
  });
}

function startBlind(s: RunState, events: Event[]) {
  Object.assign(s, { phase: 'rolling', target: target(s.ante, s.blind), score: 0, handsLeft: HANDS, rerollsLeft: REROLLS });
  events.push({ t: 'blindStart', ante: s.ante, blind: s.blind, target: s.target });
  roll(s, []);
  events.push({ t: 'rolled', values: values(s) });
}

function cashOut(s: RunState, events: Event[]) {
  const reward = REWARD[s.blind];
  const handBonus = s.handsLeft;
  const interest = Math.min(5, Math.floor(s.money / 5)); // on money held before payout
  s.money += reward + handBonus + interest;
  events.push({ t: 'cashOut', reward, handBonus, interest });
  if (s.blind === 'boss' && s.ante === WIN_ANTE && !s.endless) {
    s.phase = 'won';
    events.push({ t: 'won' });
  } else s.phase = 'cleared';
}

function advance(s: RunState) {
  if (s.blind === 'small') s.blind = 'big';
  else if (s.blind === 'big') s.blind = 'boss';
  else { s.blind = 'small'; s.ante++; }
}
