# Dicetro

A single-player roguelike dice game. You roll five dice Yahtzee-style, score them Balatro-style (chips × mult), and survive escalating blinds with Jokers, a shop, Tarots that reshape your dice, and boss blinds. Clear Ante 8 to win, then keep going in endless mode.

Game design doc (GDD): [`docs/GDD.md`](docs/GDD.md)

## Play locally

Requires Node 24+.

```bash
npm ci
npm run dev          # http://localhost:5173
```

Controls:
- Tap dice (or press **1–5**) to select them.
- **Play** (Enter) scores the selection. **Reroll** (R) rerolls it.
- **Esc** cancels a pick.
- The run saves automatically and resumes after a refresh.

**Dev panel:** add `?dev` to the URL (http://localhost:5173/?dev) for buttons that give Jokers, Tarots, Weights, money, or an almost-cleared blind.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Web app with hot reload |
| `npm run build` | Production build to `apps/web/dist` |
| `npm test` | Engine + sim tests (Vitest) |
| `npm run typecheck` | TypeScript across all workspaces |
| `npm run sim -- --runs 300 --policy greedy` | Balance simulation: a bot plays seeded runs and reports win rate, clear rate per blind, and Joker outcomes. Use `--policy noshop` for a no-Joker baseline. |

## Project layout

```
packages/engine   Rules engine: pure TypeScript, deterministic, no UI. Single source of truth.
  src/run.ts        RunState, newRun, apply(action) -> {state, events}, legalActions
  src/combos.ts     Combo detection and base values
  src/scoring.ts    Balatro-order scoring pipeline (dice -> stickers -> Jokers)
  src/jokers.ts     Joker registry (hook-based)
  src/consumables.ts  Tarots and Weights
  src/shop.ts       Shop and packs
  src/bosses.ts     Boss blinds and debuffs
packages/sim      Headless balance bot + report
apps/web          React + Vite UI that renders engine state
docs/             Design doc and implementation plans
```

Every random roll comes from named seeded streams stored in the run state. The same seed and the same actions always replay identically.

## Deploy

`vercel.json` builds the web app from the repo root (`npm run build`, output `apps/web/dist`).

```bash
npx vercel login
npx vercel          # preview deploy
npx vercel --prod   # production
```

## Credits

- Game design inspired by **Balatro** (LocalThunk / Playstack) and **Yahtzee** (Hasbro).
- Mechanics are reimplemented from public documentation. No code, art, names or text are copied. Every Joker, Tarot and boss has an original name.
- Fonts: [Bowlby One](https://fonts.google.com/specimen/Bowlby+One) and [Martian Mono](https://fonts.google.com/specimen/Martian+Mono), both SIL Open Font License, loaded from Google Fonts.

All rights reserved.
