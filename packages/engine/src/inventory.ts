import type { Consumable } from './consumables';
import type { JokerId } from './jokers';
import type { RunState } from './run';

export const JOKER_SLOTS = 5;
export const CONSUMABLE_SLOTS = 2;

/** Adds a Joker if a slot is free (shop, packs, dev tools). Mutates `s`. */
export function addJoker(s: RunState, id: JokerId): boolean {
  if (s.jokers.length >= JOKER_SLOTS) return false;
  s.jokers.push({ id, uid: `j${s.uid++}`, state: { n: 0 } });
  return true;
}

export function addConsumable(s: RunState, c: Consumable): boolean {
  if (s.consumables.length >= CONSUMABLE_SLOTS) return false;
  s.consumables.push(c);
  return true;
}

export const sellValue = (cost: number) => Math.max(1, Math.floor(cost / 2));
