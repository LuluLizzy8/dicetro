import { COMBOS, type Combo } from './combos';
import { tarot, TAROT_IDS, WEIGHT_COST, type Target, type TarotId } from './consumables';
import { makeD10, type Die, type Sticker } from './dice';
import { InvalidAction } from './errors';
import { addConsumable, addJoker } from './inventory';
import { joker, JOKER_IDS, type JokerId, type Rarity } from './jokers';
import { int, pick, sample, type Rng } from './rng';
import type { RunState } from './run';

export type ShopItem = { kind: 'joker'; id: JokerId } | { kind: 'tarot'; id: TarotId } | { kind: 'weight'; combo: Combo };
export type PackKind = 'dice' | 'tarot' | 'weight';
export type PackOption = { kind: 'die'; name: string; die: Die } | { kind: 'tarot'; id: TarotId } | { kind: 'weight'; combo: Combo };
/** Bought slots become null so the layout stays put. */
export type Shop = { items: (ShopItem | null)[]; packs: (PackKind | null)[]; rerollCost: number };
export type Pack = { kind: PackKind; options: PackOption[] };

export const SHOP_REROLL = 5;
export const PACK_COST = 4;
const PACK_KINDS: PackKind[] = ['dice', 'tarot', 'weight'];
export const PACK_INFO: Record<PackKind, { name: string; text: string }> = {
  dice: { name: 'Dice Pack', text: 'Choose 1 of 3 dice to replace one of yours' },
  tarot: { name: 'Tarot Pack', text: 'Choose 1 of 3 Tarots and use it now' },
  weight: { name: 'Weight Pack', text: 'Choose 1 of 3 Weights and use it now' },
};

export function itemCost(it: ShopItem): number {
  if (it.kind === 'joker') return joker(it.id).cost;
  return it.kind === 'tarot' ? tarot(it.id).cost : WEIGHT_COST;
}

const fromValues = (id: string, values: number[], sticker?: Sticker): Die => ({
  id,
  faces: values.map((value, i) => ({ id: `${id}f${i}`, value, ...(sticker ? { sticker } : {}) })),
});
const D10 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const PAIRED = (vs: number[]) => vs.flatMap((v) => [v, v]);

/** Dice that can appear in a Dice Pack (design §7.1). */
export const PACK_DICE: { name: string; make: (id: string, r: Rng) => Die }[] = [
  {
    name: 'Stickered d10',
    make: (id, r) => {
      const d = makeD10(id);
      d.faces[int(r, 10)].sticker = pick(r, ['bonus', 'mult', 'wild', 'glass', 'steel', 'gold', 'lucky'] as const);
      return d;
    },
  },
  { name: 'd6', make: (id) => fromValues(id, [1, 2, 3, 4, 5, 6]) },
  { name: 'Odd Die', make: (id) => fromValues(id, PAIRED([1, 3, 5, 7, 9])) },
  { name: 'Even Die', make: (id) => fromValues(id, PAIRED([2, 4, 6, 8, 10])) },
  { name: 'Heavy Die', make: (id) => fromValues(id, PAIRED([6, 7, 8, 9, 10])) },
  { name: 'Twin Die', make: (id, r) => fromValues(id, PAIRED(sample(r, D10, 5).sort((a, b) => a - b))) },
  {
    name: 'Stone Die',
    make: (id, r) => {
      const d = makeD10(id);
      for (const i of sample(r, [...D10.keys()], 3)) d.faces[i].sticker = 'stone';
      return d;
    },
  },
  { name: 'Glass Die', make: (id) => fromValues(id, D10, 'glass') },
  { name: 'Ladder Die', make: (id) => fromValues(id, PAIRED([3, 4, 5, 6, 7])) },
];

function spend(s: RunState, cost: number) {
  if (s.money < cost) throw new InvalidAction(`need $${cost}`);
  s.money -= cost;
}

function rollJoker(s: RunState, taken: JokerId[]): JokerId | null {
  const x = int(s.rng.shop, 100);
  const rarity: Rarity = x < 70 ? 'common' : x < 95 ? 'uncommon' : 'rare';
  const owned = new Set<JokerId>([...s.jokers.map((j) => j.id), ...taken]);
  const free = JOKER_IDS.filter((id) => !owned.has(id)); // no duplicate Jokers
  const pool = free.filter((id) => joker(id).rarity === rarity);
  if (pool.length) return pick(s.rng.shop, pool);
  return free.length ? pick(s.rng.shop, free) : null;
}

function rollItems(s: RunState): ShopItem[] {
  const items: ShopItem[] = [];
  for (let k = 0; k < 2; k++) {
    const x = int(s.rng.shop, 100);
    const id = x < 70 ? rollJoker(s, items.flatMap((i) => (i.kind === 'joker' ? [i.id] : []))) : null;
    if (id) items.push({ kind: 'joker', id });
    else if (x < 85) items.push({ kind: 'tarot', id: pick(s.rng.shop, TAROT_IDS) });
    else items.push({ kind: 'weight', combo: pick(s.rng.shop, COMBOS) });
  }
  return items;
}

export function openShop(s: RunState) {
  s.phase = 'shop';
  s.shop = { items: rollItems(s), packs: [pick(s.rng.packs, PACK_KINDS), pick(s.rng.packs, PACK_KINDS)], rerollCost: SHOP_REROLL };
}

export function rerollShop(s: RunState) {
  const shop = s.shop!;
  spend(s, shop.rerollCost);
  shop.rerollCost++;
  shop.items = rollItems(s);
}

export function buy(s: RunState, what: 'item' | 'pack', slot: number) {
  const shop = s.shop!;
  if (what === 'item') {
    const it = shop.items[slot];
    if (!it) throw new InvalidAction('nothing in that slot');
    const cost = itemCost(it);
    if (s.money < cost) throw new InvalidAction(`need $${cost}`);
    const ok = it.kind === 'joker'
      ? addJoker(s, it.id)
      : addConsumable(s, it.kind === 'tarot' ? { kind: 'tarot', id: it.id } : { kind: 'weight', combo: it.combo });
    if (!ok) throw new InvalidAction('no free slot');
    s.money -= cost;
    shop.items[slot] = null;
    return;
  }
  const kind = shop.packs[slot];
  if (!kind) throw new InvalidAction('no pack in that slot');
  spend(s, PACK_COST);
  shop.packs[slot] = null;
  s.pack = { kind, options: rollPack(s, kind) };
  s.phase = 'pack';
}

function rollPack(s: RunState, kind: PackKind): PackOption[] {
  const r = s.rng.packs;
  if (kind === 'tarot') return sample(r, TAROT_IDS, 3).map((id) => ({ kind: 'tarot', id }));
  if (kind === 'weight') return sample(r, COMBOS, 3).map((combo) => ({ kind: 'weight', combo }));
  return sample(r, PACK_DICE, 3).map((d) => ({ kind: 'die', name: d.name, die: d.make(`n${s.uid++}`, r) }));
}

/** Takes one pack option. Dice need `replace` (which of your dice to swap out); Tarots may need `target`. */
export function pickFromPack(s: RunState, index: number, replace?: number, target?: Target) {
  const o = s.pack!.options[index];
  if (!o) throw new InvalidAction('no option there');
  if (o.kind === 'die') {
    if (replace === undefined || !Number.isInteger(replace) || replace < 0 || replace >= s.dice.length) {
      throw new InvalidAction('choose which die to replace');
    }
    s.dice[replace] = o.die;
    s.shown[replace] = o.die.faces[0].id;
  } else if (o.kind === 'tarot') tarot(o.id).use(s, target ?? {});
  else s.levels[o.combo]++;
  closePack(s);
}

export function closePack(s: RunState) {
  s.pack = null;
  s.phase = 'shop';
}
