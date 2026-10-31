import { activeBoss, isDebuffed } from './bosses';
import { BASE, COMBOS, DEFAULT_RULES, detect, type Combo, type Rules } from './combos';
import { shownFace, type Face } from './dice';
import { joker, type Ctx, type Fx } from './jokers';
import { int } from './rng';
import type { RunState } from './run';

export type Levels = Record<Combo, number>;

export const startLevels = (): Levels => Object.fromEntries(COMBOS.map((c) => [c, 1])) as Levels;

export function comboBase(combo: Combo, level: number) {
  const b = BASE[combo];
  return { chips: b.chips + b.lvlChips * (level - 1), mult: b.mult + b.lvlMult * (level - 1) };
}

/** `src` is 'face', a sticker name, 'shatter', or `joker:<uid>`. `die` is a die index. */
export type ScoreStep =
  | { t: 'base'; combo: Combo; chips: number; mult: number }
  | ({ t: 'fx'; src: string; die?: number } & Fx);

export type ScoreResult = { combo: Combo; scored: number[]; chips: number; mult: number; total: number; steps: ScoreStep[] };

export function rulesFor(s: RunState): Rules {
  const r = { ...DEFAULT_RULES };
  for (const j of s.jokers) joker(j.id).rules?.(r);
  return r;
}

/** Combo the selected dice would score (UI preview). */
export function previewCombo(s: RunState, sel: number[]): Combo {
  return detect(sel.map((i) => shownFace(s, i)), rulesFor(s)).combo;
}

/**
 * Scores the selected dice (die indices) in Balatro order (design §5) and mutates `s`
 * for side effects: joker state, money from Lucky, Glass shatter, combo counts.
 */
export function scoreHand(s: RunState, sel: number[]): ScoreResult {
  const { combo, scored: local } = detect(sel.map((i) => shownFace(s, i)), rulesFor(s));
  const scored = local.map((j) => sel[j]).sort((a, b) => a - b);
  s.comboCounts[combo]++;
  const ctx: Ctx = { s, combo, scored, last: s.handsLeft === 1 };
  for (const j of s.jokers) joker(j.id).onScoreStart?.(j, ctx);

  let { chips, mult } = comboBase(combo, s.levels[combo]);
  if (activeBoss(s) === 'flint') {
    chips = Math.max(1, Math.floor(chips / 2));
    mult = Math.max(1, Math.floor(mult / 2));
  }
  const steps: ScoreStep[] = [{ t: 'base', combo, chips, mult }];
  const add = (src: string, fx: Fx | null | undefined, die?: number) => {
    if (!fx) return;
    chips += fx.chips ?? 0;
    mult += fx.mult ?? 0;
    mult *= fx.xmult ?? 1;
    s.money += fx.money ?? 0;
    steps.push({ t: 'fx', src, ...(die === undefined ? {} : { die }), ...fx });
  };

  const shattered: [number, Face][] = [];
  for (const i of scored) {
    if (isDebuffed(s, i)) {
      steps.push({ t: 'fx', src: 'debuffed', die: i });
      continue;
    }
    const f = shownFace(s, i);
    const times = 1 + s.jokers.reduce((n, j) => n + (joker(j.id).retrigger?.(j, ctx, f) ?? 0), 0);
    for (let k = 0; k < times; k++) {
      add('face', { chips: f.sticker === 'stone' ? 50 : f.value }, i);
      if (f.sticker === 'bonus') add('bonus', { chips: 30 }, i);
      if (f.sticker === 'mult') add('mult', { mult: 4 }, i);
      if (f.sticker === 'glass') add('glass', { xmult: 2 }, i);
      if (f.sticker === 'lucky') {
        if (int(s.rng.lucky, 5) === 0) add('lucky', { mult: 20 }, i);
        if (int(s.rng.lucky, 15) === 0) add('lucky', { money: 20 }, i);
      }
      for (const j of s.jokers) add(`joker:${j.uid}`, joker(j.id).onDie?.(j, ctx, f), i);
    }
    if (f.sticker === 'glass' && int(s.rng.glass, 4) === 0) shattered.push([i, f]);
  }

  // Unscored = dice the player did not select (the "held in hand" analog).
  s.dice.forEach((_, i) => {
    if (!sel.includes(i) && !isDebuffed(s, i) && shownFace(s, i).sticker === 'steel') add('steel', { xmult: 1.5 }, i);
  });

  for (const j of s.jokers) add(`joker:${j.uid}`, joker(j.id).onJoker?.(j, ctx));

  for (const [i, f] of shattered) {
    delete f.sticker;
    steps.push({ t: 'fx', src: 'shatter', die: i });
  }
  return { combo, scored, chips, mult, total: Math.floor(chips * mult), steps };
}
