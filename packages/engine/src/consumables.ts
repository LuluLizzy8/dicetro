import { BASE, COMBO_NAMES, type Combo } from './combos';
import type { Sticker } from './dice';
import { InvalidAction } from './errors';
import { int } from './rng';
import type { RunState } from './run';

/**
 * Every target is picked as faces. The die (and value) come from the first face,
 * so one UI picker covers all Tarots.
 */
export type Target = { faces?: string[] };
export type TargetKind = 'none' | 'die' | 'face' | 'twoFaces' | 'upToTwo' | 'dieValue';

export type TarotDef = { name: string; text: string; cost: number; target: TargetKind; use: (s: RunState, t: Target) => void };
export type Consumable = { kind: 'tarot'; id: TarotId } | { kind: 'weight'; combo: Combo };

type Loc = { d: number; f: number };

function locate(s: RunState, id: string): Loc {
  for (let d = 0; d < s.dice.length; d++) {
    const f = s.dice[d].faces.findIndex((x) => x.id === id);
    if (f >= 0) return { d, f };
  }
  throw new InvalidAction(`unknown face ${id}`);
}

function pick(s: RunState, t: Target, min: number, max: number): Loc[] {
  const ids = Array.isArray(t.faces) ? t.faces : [];
  if (ids.length < min || ids.length > max || new Set(ids).size !== ids.length) {
    throw new InvalidAction(`choose ${min === max ? min : `${min}-${max}`} face(s)`);
  }
  return ids.map((id) => locate(s, id));
}

/** A Tarot that removed the face currently showing rerolls that die. */
function fixShown(s: RunState, d: number) {
  const die = s.dice[d];
  if (!die.faces.some((f) => f.id === s.shown[d])) s.shown[d] = die.faces[int(s.rng.dice, die.faces.length)].id;
}

const face = (s: RunState, l: Loc) => s.dice[l.d].faces[l.f];

function gilder(sticker: Sticker, label: string): TarotDef {
  return {
    name: `Gilder: ${label}`,
    text: `Give every face of one value on a die a ${label} sticker`,
    cost: 3,
    target: 'dieValue',
    use: (s, t) => {
      const [l] = pick(s, t, 1, 1);
      const v = face(s, l).value;
      for (const f of s.dice[l.d].faces) if (f.value === v) f.sticker = sticker;
    },
  };
}

export const TAROTS = {
  chisel: {
    name: 'The Chisel', text: 'Remove a chosen face from a die', cost: 6, target: 'face',
    use: (s, t) => {
      const [l] = pick(s, t, 1, 1);
      if (s.dice[l.d].faces.length <= 1) throw new InvalidAction('a die keeps at least 1 face');
      s.dice[l.d].faces.splice(l.f, 1);
      fixShown(s, l.d);
    },
  },
  shatter: {
    name: 'The Shatter', text: 'Remove 2 random faces from a chosen die', cost: 5, target: 'die',
    use: (s, t) => {
      const [l] = pick(s, t, 1, 1);
      const faces = s.dice[l.d].faces;
      if (faces.length <= 1) throw new InvalidAction('a die keeps at least 1 face');
      for (let k = 0; k < 2 && faces.length > 1; k++) faces.splice(int(s.rng.tarot, faces.length), 1);
      fixShown(s, l.d);
    },
  },
  mold: {
    name: 'The Mold', text: 'Pick two faces on one die: the first becomes a copy of the second', cost: 3, target: 'twoFaces',
    use: (s, t) => {
      const [a, b] = pick(s, t, 2, 2);
      if (a.d !== b.d) throw new InvalidAction('both faces must be on the same die');
      const src = face(s, b);
      const dst = face(s, a);
      dst.value = src.value;
      if (src.sticker) dst.sticker = src.sticker;
      else delete dst.sticker;
    },
  },
  forge: {
    name: 'The Forge', text: '+1 to up to 2 faces (max 10)', cost: 3, target: 'upToTwo',
    use: (s, t) => { for (const l of pick(s, t, 1, 2)) face(s, l).value = Math.min(10, face(s, l).value + 1); },
  },
  sun: {
    name: 'The Sun', text: 'Make up to 2 faces even (+1 if odd)', cost: 3, target: 'upToTwo',
    use: (s, t) => { for (const l of pick(s, t, 1, 2)) if (face(s, l).value % 2) face(s, l).value++; },
  },
  moon: {
    name: 'The Moon', text: 'Make up to 2 faces odd (-1 if even)', cost: 3, target: 'upToTwo',
    use: (s, t) => { for (const l of pick(s, t, 1, 2)) if (face(s, l).value % 2 === 0) face(s, l).value--; },
  },
  mirror: {
    name: 'The Mirror', text: 'Add a copy of a chosen face to its die', cost: 4, target: 'face',
    use: (s, t) => {
      const [l] = pick(s, t, 1, 1);
      const src = face(s, l);
      s.dice[l.d].faces.push({ ...src, id: `${s.dice[l.d].id}u${s.uid++}` });
    },
  },
  gildBonus: gilder('bonus', 'Bonus'),
  gildMult: gilder('mult', 'Mult'),
  gildGlass: gilder('glass', 'Glass'),
  gildLucky: gilder('lucky', 'Lucky'),
  hermit: {
    name: 'The Hermit', text: 'Double your money (max +$20)', cost: 3, target: 'none',
    use: (s) => { s.money += Math.min(20, Math.max(0, s.money)); },
  },
} satisfies Record<string, TarotDef>;

export type TarotId = keyof typeof TAROTS;
export const TAROT_IDS = Object.keys(TAROTS) as TarotId[];
export const tarot = (id: TarotId): TarotDef => TAROTS[id];

export const WEIGHT_COST = 3;

export function consumableInfo(c: Consumable): { name: string; text: string; cost: number; target: TargetKind } {
  if (c.kind === 'tarot') return tarot(c.id);
  const b = BASE[c.combo];
  return {
    name: `${COMBO_NAMES[c.combo]} Weight`,
    text: `Level up ${COMBO_NAMES[c.combo]}: +${b.lvlChips} chips, +${b.lvlMult} mult`,
    cost: WEIGHT_COST,
    target: 'none',
  };
}

export function useConsumable(s: RunState, slot: number, t: Target = {}) {
  const c = s.consumables[slot];
  if (!c) throw new InvalidAction('no consumable in that slot');
  if (c.kind === 'weight') s.levels[c.combo]++;
  else tarot(c.id).use(s, t);
  s.consumables.splice(slot, 1);
}
