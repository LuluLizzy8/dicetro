# Dicetro Shop, Packs and Bosses (Plan 3 of 4)

**Goal:** Close the run loop. Clearing a blind leads to the shop, where you buy Jokers, Tarots, Weights and packs. Boss blinds have real effects.

## Decisions (from design §7 and §10, plus Balatro defaults)
- **Flow:**
  - cleared → `next` → **shop** → `next` → next blind;
  - won → `endless` → shop.
  - The next ante's boss is picked when the ante starts and shown on the blind card.
- **Shop:**
  - 2 item slots: 70% Joker, 15% Tarot, 15% Weight.
  - Joker rarity: 70 / 25 / 5% for common / uncommon / rare. No duplicates of owned or listed Jokers.
  - 2 pack slots, each one of Dice / Tarot / Weight.
  - Shop reroll costs $5, +$1 per reroll in the same shop. Bought slots stay empty.
- **Packs ($4):**
  - Pick 1 of 3 options or skip.
  - Dice options replace a die you choose. Tarot options are used immediately (same face targeting as held Tarots). Weight options are applied immediately.
- **Pack dice:** Stickered d10, d6, Odd, Even, Heavy, Twin, Stone, Glass, Ladder (design §7.1).
- **Bosses:**
  - Regular, with minimum ante: Odd One, Even One, Drought (3+), Wall (2+), Flint (2+), Spindle (2+).
  - Finishers (every 8th ante): Velvet Rope, Rusted Lock.
  - Debuffed dice still form combos but add no chips and trigger nothing. A Wild face is debuffed by both parity bosses.
  - The Wall and Velvet Rope multiply the normal boss target ×2 and ×3, which equals design §11.2 #11 (×4 and ×6 of the ante base).
- **New RNG streams:** `shop`, `packs`, `boss`.

## Files
- `packages/engine/src/bosses.ts`, `shop.ts`, `inventory.ts` (slots and add/sell helpers moved out of run.ts).
- `run.ts`: new phases `shop` and `pack`, and new actions `buy`, `rerollShop`, `pick`, `skipPack`.
- `apps/web/src/Shop.tsx` (ShopView, PackView); boss info on the blind card; rusted and debuffed dice styling; dev "Almost win".

## Verification
- 99 engine tests (shop, packs, every boss effect, updated flow tests, random-play invariants).
- Browser run: shop → buy → open pack → take option → next blind → boss blind with debuffs shown.
