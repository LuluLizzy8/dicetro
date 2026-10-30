export type Sticker = 'bonus' | 'mult' | 'wild' | 'glass' | 'steel' | 'stone' | 'gold' | 'lucky';
export const STICKERS: Sticker[] = ['bonus', 'mult', 'wild', 'glass', 'steel', 'stone', 'gold', 'lucky'];

export const STICKER_TEXT: Record<Sticker, string> = {
  bonus: '+30 chips when scored',
  mult: '+4 mult when scored',
  wild: 'Counts as both odd and even',
  glass: 'x2 mult when scored; 1 in 4 to lose the sticker',
  steel: 'x1.5 mult while not played',
  stone: '+50 chips, no value, always scores',
  gold: '$3 at cash-out if not played on the closing hand',
  lucky: '1 in 5: +20 mult. 1 in 15: +$20',
};

export type Face = { id: string; value: number; sticker?: Sticker };
export type Die = { id: string; faces: Face[] };

export function makeD10(id: string): Die {
  return { id, faces: Array.from({ length: 10 }, (_, i) => ({ id: `${id}f${i}`, value: i + 1 })) };
}

export function shownFace(s: { dice: Die[]; shown: string[] }, i: number): Face {
  return s.dice[i].faces.find((f) => f.id === s.shown[i])!;
}

export const isStone = (f: Face) => f.sticker === 'stone';
export const isOdd = (f: Face) => f.sticker === 'wild' || (!isStone(f) && f.value % 2 === 1);
export const isEven = (f: Face) => f.sticker === 'wild' || (!isStone(f) && f.value % 2 === 0);
/** Face value for value-based effects; Stone faces have none. */
export const rank = (f: Face) => (isStone(f) ? 0 : f.value);
