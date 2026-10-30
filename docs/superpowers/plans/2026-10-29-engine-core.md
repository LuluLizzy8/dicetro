# Dicetro Engine Core Implementation Plan (Plan 1 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deterministic, tested TypeScript rules engine covering dice, combo detection, base scoring, and the blind/ante loop (rolling, rerolls, scoring, cash-out, win at Ante 8, endless). No Jokers, stickers, tarots, or shop yet.

**Architecture:** One package `packages/engine` holding pure functions over a plain-JSON `RunState`. `apply(state, action)` deep-copies the state, validates the action, and returns `{state, events}`. Randomness comes from named seeded streams stored in the state (design doc §11.1).

**Tech Stack:** TypeScript (strict), Vitest, npm workspaces, GitHub Actions.

Later plans: (2) content system with Jokers, stickers, Tarots and Weights through hooks; (3) shop, packs, and bosses; (4) React + Vite web UI.

---

## File map

| File | Responsibility |
|---|---|
| `package.json` | npm workspaces root; `test` and `typecheck` scripts |
| `packages/engine/package.json`, `tsconfig.json` | engine package config |
| `packages/engine/src/rng.ts` | mulberry32 PRNG, named streams, state as a plain number |
| `packages/engine/src/dice.ts` | `Face`, `Die`, `makeD10` |
| `packages/engine/src/combos.ts` | combo list, base values, `detect(values)` |
| `packages/engine/src/scoring.ts` | levels, `comboBase`, `scoreHand` |
| `packages/engine/src/blinds.ts` | targets and rewards |
| `packages/engine/src/run.ts` | `RunState`, `newRun`, `apply`, `legalActions`, `values` |
| `packages/engine/src/index.ts` | public exports |
| `packages/engine/test/*.test.ts` | one test file per module |
| `.github/workflows/ci.yml` | typecheck and test on push |

---

### Task 1: Repo scaffold

- [ ] `git init`, then add `.gitignore` containing `node_modules/` and `dist/`.
- [ ] Root `package.json`:
```json
{
  "name": "dicetro",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "test": "npm test -w @dicetro/engine",
    "typecheck": "npm run typecheck -w @dicetro/engine"
  }
}
```
- [ ] `packages/engine/package.json`:
```json
{
  "name": "@dicetro/engine",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" }
}
```
- [ ] `packages/engine/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "strict": true, "noEmit": true, "skipLibCheck": true, "lib": ["ES2022"]
  },
  "include": ["src", "test"]
}
```
- [ ] `npm i -D typescript vitest -w @dicetro/engine`
- [ ] Commit: `chore: scaffold engine package`

### Task 2: RNG

- [ ] Test `test/rng.test.ts`: the same seed and stream give the same sequence; different streams give different sequences; `int(r, n)` stays in `[0, n)`; the state round-trips through JSON.
- [ ] Implement `src/rng.ts`:
```ts
export type Rng = { s: number };
export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function makeRng(seed: string, stream: string): Rng { return { s: hashSeed(`${seed}:${stream}`) }; }
export function next(r: Rng): number {
  r.s = (r.s + 0x6d2b79f5) | 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function int(r: Rng, n: number): number { return Math.floor(next(r) * n); }
```
- [ ] Run `npm test`; expect PASS. Commit `feat(engine): seeded rng streams`.

### Task 3: Dice

- [ ] Test: `makeD10('d0')` has 10 faces, values 1..10, and unique ids.
- [ ] Implement `src/dice.ts`:
```ts
export type Face = { id: string; value: number };
export type Die = { id: string; faces: Face[] };
export function makeD10(id: string): Die {
  return { id, faces: Array.from({ length: 10 }, (_, i) => ({ id: `${id}f${i}`, value: i + 1 })) };
}
```
- [ ] Commit `feat(engine): dice model`.

### Task 4: Combo detection

- [ ] Test `test/combos.test.ts` with table cases. Each case is a selection, the expected combo, and the expected scored indices:
  - `[3,3,3,3,3]` fiveKind
  - `[2,2,2,2,7]` fourKind, scored `[0,1,2,3]`
  - `[1,1,1,3,3]` parityHouse
  - `[1,1,1,2,2]` fullHouse
  - `[2,3,4,5,6]` largeStraight
  - `[6,6,6,1,2]` threeKind, scored `[0,1,2]`
  - `[3,4,5,6,6]` smallStraight, scored `[0,1,2,3]`
  - `[1,3,5,7,7]` parity
  - `[4,4,9,9,1]` twoPair, scored `{0,1,2,3}`
  - `[2,2,3]` pair, scored `[0,1]`
  - `[4,9,2]` highDie, scored `[1]`
  - `[2,3,4,5]` smallStraight
  - `[1,3,5,7]` highDie, scored `[3]` (parity needs 5 dice)
  - `[]` and a 6-value selection throw
- [ ] Implement `src/combos.ts` (code exactly as committed: `COMBOS`, `COMBO_NAMES`, `BASE` from design §5.1, `detect`).
- [ ] Commit `feat(engine): combo detection`.

### Task 5: Scoring

- [ ] Tests:
  - `[2,2,3]` at level 1 → chips 14, mult 2, total 28.
  - At pair level 2 → (25+4)×3 = 87.
  - `[10,10,10,10,10]` → (100+50)×10 = 1500.
  - `[4,9,2]` → 14.
  - Steps contain base + one die step per scored die.
- [ ] Implement `src/scoring.ts` (`Levels`, `startLevels`, `comboBase`, `scoreHand`).
- [ ] Commit `feat(engine): base scoring`.

### Task 6: Blinds

- [ ] Tests:
  - Ante 1 = 300 / 400 / 500.
  - Ante 2 = 800 / 1200 / 1600.
  - Ante 8 boss = 100000.
  - Ante 9 small > 50000.
- [ ] Implement `src/blinds.ts`. The Ante 9+ formula is marked `shortcut:`.
- [ ] Commit `feat(engine): blind targets`.

### Task 7: Run state machine

- [ ] Tests `test/run.test.ts`:
  - **Determinism:** the same seed gives the same dice.
  - **New run:** starts at ante 1 small, target 300, 4 hands, 10 rerolls, $4.
  - **Reroll keeps dice:** locked dice keep their values, `rerollsLeft` drops to 9, and the input state is unchanged.
  - **Invalid rerolls:** keeping all 5, duplicate indices, an out-of-range index, or rerolling with 0 rerolls each throw `InvalidAction`.
  - **Score:** decrements hands, adds to the score, and emits `scored` + `rolled`.
  - **Invalid scores:** `[]`, `[0,0]` and `[5]` each throw.
  - **Lose:** 4 hands below target → phase `lost`, and `legalActions` is empty.
  - **Clear:** with 1-face dice of value 10, scoring all 5 → 1500, phase `cleared`, money 4+3+3+0 = 10. Then `next` → big blind, target 400, hands and rerolls reset.
  - **Win:** at ante 8 boss with target 1 → `won`. Then `endless` → ante 9 small with `endless` true.
- [ ] Test `test/invariants.test.ts`: for 20 seeds, play random legal actions (from a seeded test rng) for up to 2000 steps. After every step, assert:
  - hands are in 0..4 and rerolls in 0..10,
  - every shown face belongs to its die,
  - the score is ≥ 0.

  Each episode must end in `lost`, since a no-Joker random player can't win 8 antes.
- [ ] Implement `src/run.ts` and `src/index.ts`.
- [ ] Commit `feat(engine): run state machine`.

### Task 8: CI

- [ ] `.github/workflows/ci.yml`: checkout, setup-node 24, `npm ci`, `npm run typecheck`, `npm test`.
- [ ] Commit `ci: typecheck and test`.

## Self-review

- **Spec coverage:** §4.1 hands/rerolls/selection ✔, §4.2 dice ✔, §5 base scoring (steps 1–2, no Jokers) ✔, §5.1 combos and levels ✔, §7 money (reward, hand bonus, interest) ✔, §10 targets ✔, §11 state machine, events and RNG streams ✔.
- **Deferred to later plans:** stickers (Stone or Wild parity in detection), Jokers, Weights, Tarots, shop, packs, bosses, saves, and UI.
- **Types:** `Combo`, `Levels`, `ScoreResult`, `RunState`, `Action` and `Event` are used consistently across tasks.
