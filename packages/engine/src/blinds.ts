export type BlindKind = 'small' | 'big' | 'boss';

const ANTE_BASE = [300, 800, 2000, 5000, 11000, 20000, 35000, 50000];
const BLIND_MULT: Record<BlindKind, number> = { small: 1, big: 1.5, boss: 2 };
const ANTE_1: Record<BlindKind, number> = { small: 300, big: 400, boss: 500 };

export const REWARD: Record<BlindKind, number> = { small: 3, big: 4, boss: 5 };

export function target(ante: number, blind: BlindKind): number {
  if (ante === 1) return ANTE_1[blind];
  // shortcut: endless uses x1.6 per ante instead of Balatro's formula; revisit once Jokers exist and the sim can tune it.
  const base = ante <= 8 ? ANTE_BASE[ante - 1] : Math.floor(50000 * 1.6 ** (ante - 8));
  return base * BLIND_MULT[blind];
}
