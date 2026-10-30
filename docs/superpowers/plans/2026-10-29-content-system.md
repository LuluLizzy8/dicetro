# Dicetro Content System Implementation Plan (Plan 2 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Jokers, face stickers, Weights and Tarots plug into the engine through hooks (design §11.1). The UI shows them, plays them, and lets you target them. A `?dev` panel hands out content until the shop exists (Plan 3).

**Architecture:**
- Content lives in registries (`JOKERS`, `TAROTS`). Each entry is a data object with optional hook functions.
- `scoreHand(state, selected)` runs the Balatro order:
  1. base,
  2. each scored die (face chips → sticker → `onDie` Jokers, repeated per retrigger),
  3. unscored dice (Steel),
  4. `onJoker` Jokers, left to right.
- Chips, mult and ×mult apply in order, so Joker order matters. State side effects (Glass shatter) apply after scoring.

**Tech Stack:** unchanged (TypeScript, Vitest, React).

## Decisions taken while planning
- **Stone stays a sticker** (`sticker: 'stone'`) instead of `value: null`. Detection skips Stone faces, so there's no null-handling everywhere.
- **Glass shatter** removes the sticker (design §6). It's checked once per scoring, not per retrigger.
- **Gold** pays $3 at cash-out for each *unselected* die showing a Gold face on the closing hand.
- **Using a Tarot** that removes the face currently showing during a blind rerolls that die (dice RNG stream).
- **Consumables** can be used in the `rolling` and `cleared` phases. Selling and reordering also work in those phases.
- **Ids:** face ids are unique across the run. New faces use `${dieId}u${uid}`.

## File map
| File | Change |
|---|---|
| `packages/engine/src/errors.ts` | `InvalidAction` (moved out of run.ts to avoid import cycles) |
| `src/dice.ts` | `Sticker`, `Face.sticker`, `isOdd`/`isEven`/`faceValue` helpers |
| `src/combos.ts` | `detect(faces, rules)`: Stone skip, Wild parity, Short Ladder |
| `src/jokers.ts` | `JokerDef`, `JOKERS` (21 v1 Jokers), `CONTAINS` |
| `src/consumables.ts` | `TAROTS` (12), Weights, `useConsumable` |
| `src/scoring.ts` | `scoreHand(state, selected)` hook pipeline |
| `src/run.ts` | jokers/consumables/comboCounts/uid/RNG streams; `use`, `sell`, `moveJoker` actions; round-end hooks; `addJoker` / `addConsumable` |
| `test/*.test.ts` | updated combos/scoring/run tests; new jokers/consumables tests |
| `apps/web/src/*` | joker row, consumable slots, dice inspector + targeting, sticker visuals, fx tally playback, `?dev` panel |

## Tasks
- [ ] 1. errors.ts and the dice sticker model. Existing tests stay green.
- [ ] 2. `detect(faces, rules)`. Tests: the old value cases, plus Wild parity, Stone excluded and still scored, Short Ladder (4-die Large Straight and Parity), and all-Stone selections.
- [ ] 3. Jokers registry plus the scoring pipeline. Tests:
  - stickers: Bonus, Mult, Glass ×2, Steel unscored, Stone +50, Lucky with a seeded RNG;
  - Jokers: Croupier, Twin Dice, Odd Duck with Wild, Rerun retrigger, Last Call, Unspent Luck, Last Roll, Hot Streak, Encore;
  - Joker order matters: +mult before ×2 differs from after.
- [ ] 4. Consumables. Tests:
  - Chisel down to the minimum of 1 face;
  - Shatter;
  - Mold copies value + sticker;
  - Forge caps at 10;
  - Sun and Moon;
  - Mirror adds a face;
  - Gilder stickers every face of the chosen value;
  - Hermit caps at +$20;
  - Weight levels up a combo;
  - bad targets throw.
- [ ] 5. Run actions and round end. Tests: sell Joker or consumable, moveJoker, Gold Tooth and Gold faces at cash-out, Rabbit's Foot destroy rate, slot limits.
- [ ] 6. Invariant test updated so the random policy only uses reroll/score/next/endless.
- [ ] 7. UI: Joker row (select → Sell / move), consumable slots (select → target → Use), dice inspector, sticker colours, fx playback with the triggering Joker flashing, `?dev` give panel.
- [ ] 8. Typecheck, test, build, browser screenshots, commit.
