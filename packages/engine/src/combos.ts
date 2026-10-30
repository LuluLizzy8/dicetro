// Precedence order, best first (design doc §5.1).
export const COMBOS = [
  'fiveKind', 'fourKind', 'parityHouse', 'fullHouse', 'largeStraight',
  'threeKind', 'smallStraight', 'parity', 'twoPair', 'pair', 'highDie',
] as const;
export type Combo = (typeof COMBOS)[number];

export const COMBO_NAMES: Record<Combo, string> = {
  fiveKind: 'Five of a Kind', fourKind: 'Four of a Kind', parityHouse: 'Parity House',
  fullHouse: 'Full House', largeStraight: 'Large Straight', threeKind: 'Three of a Kind',
  smallStraight: 'Small Straight', parity: 'Parity', twoPair: 'Two Pair', pair: 'Pair', highDie: 'High Die',
};

export const BASE: Record<Combo, { chips: number; mult: number; lvlChips: number; lvlMult: number }> = {
  fiveKind: { chips: 100, mult: 10, lvlChips: 35, lvlMult: 3 },
  fourKind: { chips: 60, mult: 7, lvlChips: 30, lvlMult: 3 },
  parityHouse: { chips: 45, mult: 4, lvlChips: 25, lvlMult: 3 },
  fullHouse: { chips: 40, mult: 4, lvlChips: 25, lvlMult: 2 },
  largeStraight: { chips: 35, mult: 4, lvlChips: 30, lvlMult: 3 },
  threeKind: { chips: 30, mult: 3, lvlChips: 20, lvlMult: 2 },
  smallStraight: { chips: 30, mult: 3, lvlChips: 20, lvlMult: 2 },
  parity: { chips: 20, mult: 2, lvlChips: 15, lvlMult: 1 },
  twoPair: { chips: 20, mult: 2, lvlChips: 20, lvlMult: 1 },
  pair: { chips: 10, mult: 2, lvlChips: 15, lvlMult: 1 },
  highDie: { chips: 5, mult: 1, lvlChips: 10, lvlMult: 1 },
};

export type Detected = { combo: Combo; scored: number[] };

/** Best combo inside a selection of 1-5 face values. `scored` = indices into `values`; ties pick the leftmost die. */
export function detect(values: number[]): Detected {
  if (values.length < 1 || values.length > 5) throw new Error('select 1-5 dice');
  const byValue = new Map<number, number[]>();
  values.forEach((v, i) => byValue.set(v, [...(byValue.get(v) ?? []), i]));
  // Groups of equal values: biggest group first, then highest value.
  const g = [...byValue.entries()].sort((a, b) => b[1].length - a[1].length || b[0] - a[0]).map(([, idx]) => idx);
  const all = values.map((_, i) => i);
  const five = values.length === 5;
  const sameParity = five && values.every((v) => v % 2 === values[0] % 2);
  const run = (len: number): number[] | null => {
    for (let lo = 10; lo >= 1; lo--) { // highest run first; faces are capped at 10
      const idx: number[] = [];
      for (let v = lo; v < lo + len && values.includes(v); v++) idx.push(values.indexOf(v));
      if (idx.length === len) return idx;
    }
    return null;
  };

  const top = g[0].length;
  const second = g[1]?.length ?? 0;
  if (top === 5) return { combo: 'fiveKind', scored: all };
  if (top === 4) return { combo: 'fourKind', scored: g[0] };
  if (top === 3 && second === 2) return { combo: sameParity ? 'parityHouse' : 'fullHouse', scored: all };
  const large = five ? run(5) : null;
  if (large) return { combo: 'largeStraight', scored: large };
  if (top === 3) return { combo: 'threeKind', scored: g[0] };
  const small = run(4);
  if (small) return { combo: 'smallStraight', scored: small };
  if (sameParity) return { combo: 'parity', scored: all };
  if (top === 2 && second === 2) return { combo: 'twoPair', scored: [...g[0], ...g[1]] };
  if (top === 2) return { combo: 'pair', scored: g[0] };
  return { combo: 'highDie', scored: [g[0][0]] };
}
