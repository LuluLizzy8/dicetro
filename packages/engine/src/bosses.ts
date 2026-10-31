import { isEven, isOdd, shownFace } from './dice';
import { int, type Rng } from './rng';
import type { RunState } from './run';

export type BossDef = { name: string; text: string; inspiredBy: string; minAnte?: number; finisher?: boolean };

export const BOSSES = {
  oddOne: { name: 'The Odd One', text: 'Odd faces are debuffed', inspiredBy: 'The Club / The Goad' },
  evenOne: { name: 'The Even One', text: 'Even faces are debuffed', inspiredBy: 'The Head / The Window' },
  drought: { name: 'The Drought', text: 'Rerolls are halved', inspiredBy: 'The Water', minAnte: 3 },
  wall: { name: 'The Wall', text: 'Target score is doubled', inspiredBy: 'The Wall', minAnte: 2 },
  flint: { name: 'The Flint', text: 'Base chips and mult are halved', inspiredBy: 'The Flint', minAnte: 2 },
  spindle: { name: 'The Spindle', text: 'Dice with 3 or fewer faces are debuffed', inspiredBy: 'new', minAnte: 2 },
  velvetRope: { name: 'Velvet Rope', text: 'Target score is tripled', inspiredBy: 'Violet Vessel', finisher: true },
  rustedLock: { name: 'Rusted Lock', text: 'Two dice are rusted in place and never reroll', inspiredBy: 'Cerulean Bell', finisher: true },
} satisfies Record<string, BossDef>;

export type BossId = keyof typeof BOSSES;
export const BOSS_IDS = Object.keys(BOSSES) as BossId[];
export const boss = (id: BossId): BossDef => BOSSES[id];

/** Finishers own every 8th ante (8, 16, ... in endless). */
export function pickBoss(ante: number, r: Rng): BossId {
  const pool = BOSS_IDS.filter((id) => {
    const b = boss(id);
    return ante % 8 === 0 ? !!b.finisher : !b.finisher && ante >= (b.minAnte ?? 1);
  });
  return pool[int(r, pool.length)];
}

/** The boss whose effect is live right now, or null outside boss blinds. */
export const activeBoss = (s: RunState): BossId | null => (s.blind === 'boss' ? s.boss : null);

/** Debuffed dice still form combos but add no chips and trigger nothing (Balatro rule). */
export function isDebuffed(s: RunState, i: number): boolean {
  const b = activeBoss(s);
  if (b === 'oddOne') return isOdd(shownFace(s, i));
  if (b === 'evenOne') return isEven(shownFace(s, i));
  if (b === 'spindle') return s.dice[i].faces.length <= 3;
  return false;
}
