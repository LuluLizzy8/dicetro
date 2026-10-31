import {
  apply, consumableInfo, isStone, itemCost, JOKER_SLOTS, newRun, scoreHand, shownFace,
  type Action, type JokerId, type RunState,
} from '@dicetro/engine';

/** 'greedy' buys Jokers and Weights in the shop; 'noshop' never buys (no-content baseline). */
export type Policy = 'greedy' | 'noshop';

export type Episode = {
  seed: string;
  won: boolean; // cleared the Ante 8 boss
  ante: number; // ante where the run ended
  blind: RunState['blind'];
  cleared: string[]; // e.g. "1-small"
  jokers: JokerId[];
  steps: number;
  end: 'won' | 'lost' | 'step-limit';
};

const ALL = [0, 1, 2, 3, 4];
const SUBSETS: number[][] = Array.from({ length: 31 }, (_, m) => ALL.filter((i) => ((m + 1) >> i) & 1));
const clone = (s: RunState): RunState => JSON.parse(JSON.stringify(s));

/** Highest-scoring selection right now, counting Jokers, stickers, and boss effects. */
export function bestPlay(s: RunState): { dice: number[]; total: number } {
  let best = { dice: [0], total: -1 };
  for (const dice of SUBSETS) {
    const total = scoreHand(clone(s), dice).total;
    if (total > best.total) best = { dice, total };
  }
  return best;
}

/** Dice to lock: the biggest matching group (both pairs on two pair), else a 4-wide straight draw, else the highest die. */
export function keepFor(s: RunState): number[] {
  const faces = ALL.map((i) => shownFace(s, i));
  const groups = new Map<number, number[]>();
  faces.forEach((f, i) => { if (!isStone(f)) groups.set(f.value, [...(groups.get(f.value) ?? []), i]); });
  const g = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || b[0] - a[0]).map(([, idx]) => idx);
  if (g[0]?.length >= 3) return g[0];
  if (g[0]?.length === 2) return g[1]?.length === 2 ? [...g[0], ...g[1]] : g[0];
  for (let lo = 7; lo >= 1; lo--) {
    const draw = [...groups.entries()].filter(([v]) => v >= lo && v < lo + 5).map(([, idx]) => idx[0]);
    if (draw.length >= 4) return draw;
  }
  const hi = faces.reduce((b, f, i) => (f.value > faces[b].value ? i : b), 0);
  return [hi];
}

function shopActions(s: RunState): Action | null {
  // Use Weights and target-free Tarots right away.
  const usable = s.consumables.findIndex((c) => consumableInfo(c).target === 'none');
  if (usable >= 0) return { t: 'use', slot: usable };
  const shop = s.shop!;
  for (let slot = 0; slot < shop.items.length; slot++) {
    const it = shop.items[slot];
    if (!it || s.money < itemCost(it)) continue;
    if (it.kind === 'joker' && s.jokers.length < JOKER_SLOTS) return { t: 'buy', what: 'item', slot };
    if (it.kind === 'weight' && s.consumables.length < 2) return { t: 'buy', what: 'item', slot };
  }
  return null;
}

export function playEpisode(seed: string, policy: Policy = 'greedy', maxSteps = 5000): Episode {
  let s = newRun(seed);
  const cleared: string[] = [];
  let budget = 0; // rerolls this hand may still spend
  let handStart = true;
  let steps = 0;
  while (steps++ < maxSteps) {
    let action: Action;
    if (s.phase === 'lost' || s.phase === 'won') break;
    if (s.phase === 'rolling') {
      if (handStart) {
        budget = Math.ceil(s.rerollsLeft / s.handsLeft);
        handStart = false;
      }
      const best = bestPlay(s);
      const need = (s.target - s.score) / s.handsLeft;
      const keep = [...new Set([...keepFor(s), ...s.locked])];
      if (best.total >= need || budget <= 0 || s.rerollsLeft === 0 || keep.length === 5) {
        action = { t: 'score', dice: best.dice };
        handStart = true;
      } else {
        action = { t: 'reroll', keep };
        budget--;
      }
    } else if (s.phase === 'cleared') {
      cleared.push(`${s.ante}-${s.blind}`);
      action = { t: 'next' };
    } else if (s.phase === 'shop') {
      action = (policy === 'greedy' && shopActions(s)) || { t: 'next' };
    } else {
      action = { t: 'skipPack' };
    }
    s = apply(s, action).state;
  }
  if (s.phase === 'won') cleared.push(`${s.ante}-${s.blind}`);
  return {
    seed, won: s.phase === 'won', ante: s.ante, blind: s.blind, cleared,
    jokers: s.jokers.map((j) => j.id), steps,
    end: s.phase === 'won' ? 'won' : s.phase === 'lost' ? 'lost' : 'step-limit',
  };
}
