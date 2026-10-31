// mulberry32. State is a plain number so it serializes with the run (save/load safe).
export type Rng = { s: number };

export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// One stream per subsystem, so e.g. a shop reroll never shifts the next dice roll.
export function makeRng(seed: string, stream: string): Rng {
  return { s: hashSeed(`${seed}:${stream}`) };
}

export function next(r: Rng): number {
  r.s = (r.s + 0x6d2b79f5) | 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function int(r: Rng, n: number): number {
  return Math.floor(next(r) * n);
}

export function pick<T>(r: Rng, xs: readonly T[]): T {
  return xs[int(r, xs.length)];
}

/** n distinct elements (partial Fisher-Yates). */
export function sample<T>(r: Rng, xs: readonly T[], n: number): T[] {
  const a = [...xs];
  for (let i = 0; i < Math.min(n, a.length); i++) {
    const j = i + int(r, a.length - i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}
