# Dicetro — Design Doc

Status: draft v1 (2026-10-29). Decisions marked **[decided]** came from the design Q&A. Items in **Open questions** (end of doc) still need a call.

## 1. Pitch

Dicetro is a single-player roguelike dice game. Yahtzee supplies the dice: roll five, lock some, reroll the rest. Balatro supplies everything around them: escalating blinds, chips × mult scoring, Jokers, a shop, consumables that permanently reshape your build, and an endless mode.

Where Balatro edits a deck of cards, Dicetro edits the dice themselves. You can remove faces, duplicate faces, sticker faces, and swap whole dice. A d10 that has been chiselled down to `{7,7,7,9,9}` plays very differently from a stock one.

## 2. Scope

| Target | Scope |
|---|---|
| v1 playable (MVP) **[decided: lean core]** | Antes 1–8 + endless, ~20 Jokers, ~10 Tarots, 11 Weights, 3 pack types, 5 regular + 2 finisher Boss Blinds, shop. Rules engine first, then web UI. |
| Later (publish) | Full Joker list (§8), vouchers, die editions, skip tags, decks/stakes, mobile via Capacitor, original art/audio, save/continue. |

Left out of v1, with reasons:
- Vouchers, skip tags, stakes, alternate decks: these are scale content, not core loop. They're the first additions after v1.
- Spectral cards: high-variance content that needs balance data from the sim bot first.
- Bag-of-dice drawing: fixed 5 dice keeps the core legible. It arrives only through a very rare Joker or upgrade (§8).

## 3. Platform **[decided]**

- **TypeScript** monorepo.
  - `packages/engine`: pure rules engine. No DOM, seeded RNG, deterministic. It is the single source of truth.
  - `apps/web`: React + Vite UI that renders engine state. Deployed to Vercel.
  - `packages/sim`: heuristic bot that plays seeded runs headless, for balance tuning (§11).
  - Tests: Vitest. CI: GitHub Actions.
- App store later: wrap `apps/web` with Capacitor. No engine changes needed.

## 4. Core loop

```
Run → Ante 1..8 (then endless)
  Ante → Small Blind → Big Blind → Boss Blind
    Blind: score ≥ target using ≤ H hands and a shared pool of R rerolls
      Hand: roll all 5 dice (free) → lock/reroll any number of times (each reroll costs 1 from pool) → Score
    Win blind → cash out → Shop → next blind
    Lose (hands = 0, score < target) → run over
  Clear Ante 8 Boss → Win screen → optional Endless
```

### 4.1 Hands and rerolls **[decided]**
- Each blind gives **H = 4 hands** and a **shared reroll pool of R = 10**. Both are tunable (see Q1).
- Every hand starts with a free roll of all 5 dice.
- The player locks any subset of dice and rerolls the rest. Each reroll costs 1 from the pool. The player can spend 0 rerolls on one hand and 7 on the next.
- **Score**: the player taps which dice to play (1–5), and the UI shows the combo name, level and chips × mult live, like Balatro. Confirming uses 1 hand. The combo is the highest-ranked combo (precedence in §5.1) inside the selection; selected dice outside that combo are played but add nothing (2-2-3 scores as a Pair, and the 3 adds no chips). Dice not selected are **unscored** (§4.1 terminology), so Steel and Gold trigger on them. Playing fewer dice on purpose (a leveled Pair instead of a Full House, or leaving a Steel die out) is the main per-hand decision.
- Unspent rerolls carry over to later hands in the same blind, then reset at the next blind.
- Terminology: **locked** = kept during a reroll (Yahtzee's "hold"). **Unscored dice** = dice showing but not part of the scoring combo. This is the analog of Balatro's "held in hand" cards, which triggers Steel, Gold and similar effects.

### 4.2 Dice **[decided]**
- Start with **5 × d10, faces 1–10** **[decided: 5, not 6]**. Simulated: 6 dice (best 5 of 6) raises the average hand about 50% and makes Ante 1 trivial (600 cleared 92% vs 60%). A 6th die stays a very rare late upgrade.
- A die is an ordered list of faces. Each face has a `value` (int ≥ 1) and an optional `sticker`.
- Dice can gain or lose faces. Minimum is **1 face** (that die always shows the same value). There's no maximum, but face-adding effects are rare.
- Face values are capped at **1–10**.
- Balance risk (simulated): with every die at 3 faces, Five of a Kind lands on 30–48% of hands with no Jokers. Response **[decided]**: keep min 1, but face-removal Tarots are rare and expensive, Five of a Kind is lowered to 100 × 10, and the boss The Spindle punishes thin dice (§10).
- Five 1-face dice with the same value = guaranteed Five of a Kind every hand. That's Balatro-style "broken build" fun, but removal Tarots need to be scarce enough that it takes a whole run.
- Every face is equally likely when rolled. Removing faces is how you raise the odds of the faces you want.
- Face value = chips added when that die scores (a 7 adds 7 chips).

### 4.3 Suits replacement **[decided: odd/even + per-face stickers]**
- **Parity** (odd/even) is the built-in "suit". It powers parity combos (the flush analog) and parity jokers.
- **Stickers** are per-face enhancements, the analog of Balatro card enhancements (§6).
- "Face cards" don't exist. Jokers that cared about faces are remapped to **high faces (8+)** or dropped.

## 5. Scoring **[decided: same as Balatro]**

`score = chips × mult`, resolved in Balatro order:
1. Base chips and mult from the combo's level.
2. For each **scored die**, left to right: + face value chips, then sticker effect, then on-score Joker effects. Retriggers repeat this step.
3. For each **unscored die**: unscored-face effects (Steel, Gold) and Jokers that trigger on unscored dice.
4. Jokers, left to right. **Each Joker resolves fully before the next one**, in position order (as in Balatro). That makes Joker order a strategy, so the player can reorder Jokers and dice. Per-die ×mult (Glass) applies in step 2, before the Jokers.
5. `floor(chips × mult)` is added to the blind's score.

### 5.1 Combos **[decided: poker-on-dice, player selects dice, repeatable + leveling]**

The engine detects the highest-ranked combo in the selected dice, using this precedence list. Base values come from Balatro where an equivalent exists.

| # | Combo | Definition | Scored dice | Base chips × mult | Per level | Source |
|---|---|---|---|---|---|---|
| 1 | Five of a Kind | 5 equal | 5 | 100 × 10 | +35 / +3 | Balatro Five of a Kind, lowered (thin dice make it common) |
| 2 | Four of a Kind | 4 equal | 4 | 60 × 7 | +30 / +3 | Balatro |
| 3 | Parity House | Full House, all same parity | 5 | 45 × 4 | +25 / +3 | Balatro Flush House, scaled down: ~47% of full houses qualify (**own choice**) |
| 4 | Full House | 3 + 2 | 5 | 40 × 4 | +25 / +2 | Balatro |
| 5 | Large Straight | 5 consecutive | 5 | 35 × 4 | +30 / +3 | Balatro Straight / Yahtzee |
| 6 | Three of a Kind | 3 equal | 3 | 30 × 3 | +20 / +2 | Balatro |
| 7 | Small Straight | 4 consecutive | 4 | 30 × 3 | +20 / +2 | Yahtzee; values **own choice** |
| 8 | Parity | all 5 odd or all 5 even | 5 | 20 × 2 | +15 / +1 | "Half a Flush"; **own choice** |
| 9 | Two Pair | 2 + 2 | 4 | 20 × 2 | +20 / +1 | Balatro |
| 10 | Pair | 2 equal | 2 | 10 × 2 | +15 / +1 | Balatro |
| 11 | High Die | none of above | highest die | 5 × 1 | +10 / +1 | Balatro High Card |

Why Parity is cheap: a Balatro Flush means 1 suit out of 4. Parity is 1 group out of 2, like "all red cards", so it's half a flush. It also gets easy with a big reroll pool, because every reroll is a 50% shot per die. So Parity sits near Two Pair, and Parity House sits between Full House and Four of a Kind instead of near the top.

Sim-based adjustments (no Jokers, heuristic bot, 100k trials): Parity House lowered because about 47% of full houses are single-parity. Straights raised because they are rarer than full houses at every reroll count. Five of a Kind lowered because thinned dice make it common.

Dropped from Balatro, because they can't exist with parity suits:
- **Straight Flush**: consecutive numbers always alternate parity.
- **Flush Five**: five of a kind is always same parity, so it collapses into Five of a Kind.

Balance note: d10 odds differ a lot from poker. For example, a fresh Large Straight roll is 0.72% and Parity is 6.25%, before rerolls. The Balatro numbers are placeholders. The sim bot (§11) runs thousands of seeded runs to tune them.

### 5.2 Leveling: "Loaded Weights" **[decided: casino theme]**
One Weight per combo. Using it levels that combo once (the Planet-card analog). Names: *Pair Weight, Two Pair Weight, Trips Weight, Small Ladder Weight, Big Ladder Weight, Parity Weight, House Weight, Quad Weight, Parity House Weight, Yahtzee Weight, High Die Weight*.

## 6. Face stickers (enhancement analog)

Applied to one **face** of a die, mostly by Tarots. A face has at most one sticker; a new one replaces the old.

| Sticker | Effect | Balatro source |
|---|---|---|
| Bonus | +30 chips when scored | Bonus Card |
| Mult | +4 mult when scored | Mult Card |
| Wild | counts as both odd and even | Wild Card (adapted: suit → parity) |
| Glass | ×2 mult when scored; 1 in 4 chance it **shatters**: the sticker is lost, the face stays | Glass Card (adapted: removing the face would be a free Chisel, so only the sticker breaks) |
| Steel | ×1.5 mult while **unscored** | Steel Card |
| Stone | +50 chips, has no value (never forms combos), always scores | Stone Card |
| Gold | $3 if showing **unscored** on the final hand of a blind | Gold Card |
| Lucky | 1 in 5: +20 mult; 1 in 15: +$20 | Lucky Card |

Later: **die editions** (Foil +50 chips, Holo +10 mult, Polychrome ×1.5 mult) apply to a whole die, mirroring card editions.

## 7. Economy and shop

All values are Balatro defaults (label: manual/wiki) unless marked otherwise.
- Start with $4. Blind rewards: Small $3, Big $4, Boss $5. +$1 per unused hand. Interest $1 per $5 held, capped at $5.
- Unused rerolls pay **$0**, same as Balatro discards.
- Joker slots: 5. Consumable slots: 2.
- Shop: 2 item slots (Jokers / Tarots / Weights) + 2 pack slots. Shop reroll costs $5 and goes up $1 per reroll in that shop.
- Sell value = half the buy price, rounded down, minimum $1.

### 7.1 Packs **[decided: pick 1 of N, replace a die]**

| Pack | Price | Contents | Effect |
|---|---|---|---|
| Dice Pack | $4 | 3 dice | Take 1 to **replace** one of your 5 dice (you choose which), or skip |
| Jumbo Dice Pack (post-MVP) | $6 | 5 dice | Take 1 |
| Tarot Pack | $4 | 3 Tarots | Use 1 immediately |
| Weight Pack | $4 | 3 Weights | Use 1 immediately |
| Joker Pack (post-MVP) | $4 | 2 Jokers | Take 1 |

Dice that can appear in a Dice Pack:

| Die | Faces | Role |
|---|---|---|
| Stickered d10 | 1–10, one random face stickered | Standard upgrade |
| d6 | 1–6 | Higher odds of matches, lower chips |
| Odd Die | 1,1,3,3,5,5,7,7,9,9 | Parity builds |
| Even Die | 2,2,4,4,6,6,8,8,10,10 | Parity builds |
| Heavy Die | 6,6,7,7,8,8,9,9,10,10 | Chips, high-face builds |
| Twin Die | 5 values, each twice | Pairs and kinds |
| Stone Die | 1–10, 3 Stone faces | Chip floor |
| Glass Die | 1–10, all Glass | Big mult, fragile |
| Ladder Die | 3,3,4,4,5,5,6,6,7,7 | Straight builds |

## 8. Jokers **[decided: original names, mapped to Balatro]**

MVP = in the v1 build. "Adapted" = the card concept was translated to dice.

| Name | Inspired by | Effect | MVP | Notes |
|---|---|---|---|---|
| Croupier | Joker | +4 mult | ✔ | Direct |
| Twin Dice | Jolly Joker | +8 mult if combo contains a Pair | ✔ | Direct |
| Triple Threat | Zany Joker | +12 mult if combo contains Three of a Kind | ✔ | Direct |
| Ladder Climber | Crazy Joker | +12 mult if combo contains a Straight (small or large) | ✔ | Direct |
| Parity Bit | Droll Joker | +10 mult if combo is Parity / Parity House | ✔ | Flush → Parity |
| Double Down | The Duo | ×2 mult if combo contains a Pair | ✔ | Direct |
| Odd Duck | Odd Todd | Scored odd faces give +31 chips | ✔ | Direct |
| Even Keel | Even Steven | Scored even faces give +4 mult | ✔ | Direct |
| Golden Ratio | Fibonacci | Scored 1, 2, 3, 5, 8 give +8 mult | ✔ | Ace→1; d10 has 8 |
| Ten-Four | Walkie Talkie | Scored 10 or 4 give +10 chips, +4 mult | ✔ | Direct |
| High Roller | Scary Face | Scored faces ≥ 8 give +30 chips | ✔ | Face card → high face |
| Snake Eyes | Scholar | Scored 1s give +20 chips, +4 mult | ✔ | Ace → 1 |
| Unspent Luck | Banner | +15 chips per remaining reroll | ✔ | Lower than Banner's +30, since the pool is bigger |
| Last Roll | Mystic Summit | +15 mult when 0 rerolls remain | ✔ | Discards → rerolls |
| Hot Streak | Green Joker | +1 mult per hand scored, −1 per reroll used (min 0) | ✔ | Discards → rerolls |
| Encore | Supernova | + mult equal to times this combo was scored this run | ✔ | Direct |
| Rerun | Hack | Retrigger scored 2, 3, 4, 5 | ✔ | Direct |
| Last Call | Dusk | Retrigger all scored dice on the final hand | ✔ | Direct |
| Lucky Rabbit's Foot | Gros Michel | +15 mult; 1 in 6 chance to be destroyed at end of round | ✔ | d6 joke |
| Gold Tooth | Golden Joker | +$4 at end of round | ✔ | Direct |
| Second Wind | Drunkard | +3 rerolls per blind | | Discards → rerolls |
| Pickpocket | Burglar | +3 hands per blind, lose all rerolls | | Direct |
| Bankroll | Bull | +2 chips per $1 held | | Direct |
| Collector | Abstract Joker | +3 mult per Joker | | Direct |
| Short Ladder | Four Fingers | Large Straight and Parity need only 4 dice | ✔ | Direct; moved into v1 so straights are a real build |
| Skip Step | Shortcut | Straights may skip one value (2-4-5-6-8) | | Direct |
| Everything's High | Pareidolia | Every face counts as high (≥ 8) | | Face card → high face |
| Low Rider | Ride the Bus | +1 mult per consecutive hand with no scored face ≥ 8 | | Face card → high face |
| Clean Slate | Blackboard | ×3 mult if every unscored die shows an even face | | Spades/clubs → even |
| Lead Die | Hanging Chad | Retrigger the first scored die twice | | Direct |
| Ironworks | Steel Joker | ×0.2 mult per Steel face across all dice | | Direct |
| Sticker Thief | Vampire | Gains ×0.1 mult per stickered face scored, removes that sticker | | Direct |
| Carbon Copy | Blueprint | Copies the Joker to the right | | Direct |
| Mimic | Brainstorm | Copies the leftmost Joker | | Direct |
| Moldmaker | DNA | If the first hand of a blind is High Die, copy that face onto a random face of another die | | Card copy → face copy |
| **Gambler's Fallacy** | *new* | +3 mult per reroll used this hand (resets each hand) | | Dice-native, rewards spending rerolls |
| **Polyhedral** | *new* | +4 mult per face removed from your dice this run | | Rewards chiselling |
| **Pip Counter** | *new* | + chips equal to the sum of all 5 dice (scored or not) | | Dice-native |
| **Freeze Frame** | *new* | First reroll each hand is free | | Dice-native economy |
| **Steady Hand** | *new* | Locked dice that end up scoring give +10 chips | | Rewards committing early |
| **Boxcars** | *new* | Scored 10s give ×1.5 mult | | High-face build payoff |
| **Critical Hit** | *new* | ×5 mult if every die shows its highest face | | Rare; Chisel synergy |

Very rare (Legendary-tier, post-MVP):

| Name | Effect |
|---|---|
| **Dice Bag** | You can keep up to 3 extra dice in a bag. Each hand draws 5 at random from all your dice. Dice Packs can add to the bag instead of replacing a die. |
| **Spare Pocket** (upgrade/voucher) | Same as Dice Bag but only +1 extra die. Shows up very rarely in the shop. |

Not portable (dropped): Juggler and Troubadour (hand size is fixed at 5 dice), Smeared Joker (only 2 "suits"), and all deck-size Jokers (no deck).

## 9. Tarots (dice-modifying consumables) **[decided: targeting varies by card]**

Kept as "Tarot" (a generic term, not Balatro IP), but every card name is original.

| Name | Inspired by | Target | Effect | MVP |
|---|---|---|---|---|
| The Chisel | *new* (Hanged Man-ish) | **Choose** die + face | Remove that face. **Rare** and priced above other Tarots | ✔ |
| The Shatter | *new* | Choose die | Remove 2 **random** faces from it. **Rare** | ✔ |
| The Mold | Death | Choose die, choose 2 faces | First face becomes a copy of the second | ✔ |
| The Forge | Strength | Choose up to 2 faces | +1 value (max 10) | ✔ |
| The Sun | The Sun (suit conversion) | Choose up to 2 faces | Make even (+1 if odd) | ✔ |
| The Moon | The Moon (suit conversion) | Choose up to 2 faces | Make odd (−1 if even, min 1) | ✔ |
| The Mirror | *new* | Choose die + face | **Add** a copy of that face to the die | ✔ |
| The Gilder | Devil / Empress / Hierophant / … | Choose a die + a value | Apply a specific sticker to **every face of that value** on the die (one face on a stock d10 shows only 10% of the time, so this keeps stickers visible). One card per sticker (8 cards) | ✔ (Bonus, Mult, Glass, Lucky) |
| The Tumble | *new* | Choose die | Re-randomize every face value (1–10), keeping stickers | |
| The Hermit | The Hermit | none | Double money (max +$20) | ✔ |
| The Seer | High Priestess | none | Create 2 random Weights | |
| The Fool | The Fool | none | Copy the last Tarot/Weight used | |
| Judgement | Judgement | none | Create a random Joker | |
| The Wheel | Wheel of Fortune | random Joker | 1 in 4: add an edition | |

## 10. Blinds

Targets follow Balatro base chips (label: manual/wiki): Ante 1 = 300 / 400 / 500 (Small / Big / Boss, lowered from Balatro's 300/450/600 because a sim showed a no-Joker player cleared the Boss only 60% of the time; now ~92/82/71%). Ante 2–8 base = 800, 2000, 5000, 11000, 20000, 35000, 50000. From Ante 2: Small = ×1, Big = ×1.5, Boss = ×2. Endless (Ante 9+) uses Balatro's endless formula. All of these are placeholders pending bot tuning (§5.1).

Bosses (MVP subset ✔):

| Boss | Inspired by | Effect | MVP |
|---|---|---|---|
| The Odd One | The Club/Goad/… (suit debuff) | Odd faces score no chips and trigger nothing | ✔ |
| The Even One | same | Even faces debuffed | ✔ |
| The Ceiling | The Plant | Faces ≥ 8 debuffed | |
| The Drought | The Water | Rerolls halved; Ante 3+ only (sim: 0 rerolls cleared Ante 1 only 2% of the time) | ✔ |
| The Needle | The Needle | 1 hand | |
| The Wall | The Wall | 4× target | ✔ |
| The Eye | The Eye | No repeat combos this blind | |
| The Mouth | The Mouth | Only one combo type this blind | |
| The Arm | The Arm | Scored combo loses a level | |
| The Flint | The Flint | Base chips and mult halved | ✔ |
| The Gauntlet | The Psychic | Combo must score all 5 dice | |
| The Hook | The Hook | After each reroll, 1 random locked die is unlocked | |
| **The Spindle** | *new* | Dice with 3 or fewer faces are debuffed | ✔ |
| **The Fog** | *new* (The House/Wheel analog) | 1 random die rolls face-down; revealed on Score | |
| Finisher: **Velvet Rope** | Violet Vessel | 6× target | ✔ |
| Finisher: **Rusted Lock** | Cerulean Bell | Two random dice are always locked (rolled on the free roll, never rerolled) | ✔ |

## 11. Engine and sim bot

The engine is a pure state machine: `newRun(seed)`, `getState()`, `legalActions()`, `apply(action)`. Both the UI and the sim bot drive it this way. As a result, runs replay exactly from seed + action log (useful for bug reports and daily-seed challenges), and the UI can't break rules.

Sim bot (heuristic, for balancing only):
- Dice: lock toward the best achievable combo by expected value. Spend rerolls proportionally to hands left.
- Shop: buy the highest-tier affordable Joker, then Weights for the most-played combo. Keep $ for interest when nothing qualifies.
- Output: win rate per ante, combo frequency, Joker pick/win rates. These tune combo values, targets, reroll pool, and prices.

### 11.1 Engine architecture (from technical review)

- **Content as data.** Every Joker, sticker, boss and edition is a data object `{id, kind, hooks, initState}` in a registry keyed by id. A hook is a pure function `(self, ctx) => Effect[]`. An Effect is `{chips?, mult?, xmult?, money?, retrigger?, destroySelf?, mutate?}`. Collect effects first, then apply, so no hook mutates state mid-scoring.
- **Hooks:** `modifyRules` (Short Ladder, Skip Step, Everything's High), `onBlindStart`, `onRoll` / `onReroll`, `rerollCost`, `onScoreStart`, `isDebuffed(face)`, `onDieScored` + `retriggers`, `onDieUnscored`, `onJoker`, `onHandEnd`, `onRoundEnd`, `shopModifiers`, `onSell`. Carbon Copy and Mimic call the target Joker's hooks with the target's state.
- **Combo detection:** brute force all subsets of the selected dice against the precedence list, using a `RuleSet {straightLen, parityLen, straightGaps, highMin}` built from `modifyRules`. Face parity is a set (Wild = {odd, even}). A Stone face has `value: null`, is skipped in detection, and is always added to the scored dice. One shared `isHigh(face, rules)` helper.
- **IDs:** `Face {id, value|null, sticker?}`, `Die {id, faces[], edition?}`. A roll result is a face id, not an index, so removing faces never shifts references.
- **RNG:** separate streams derived from the seed (`dice`, `shop`, `packs`, `lucky`, `glass`, `boss`, `jokerProc`, `tarot`), so a shop reroll never changes the next dice roll. The PRNG state is plain numbers stored in the run state (sfc32 or mulberry32, about 10 lines, no library).
- **Events:** `apply(action)` returns `{state, events[]}` (e.g. `{t:"dieScored", die, chips:+7}`). The UI animates the events and never re-runs scoring itself.
- **Actions** include `reorderJokers` and `reorderDice`. `legalActions()` returns action shapes, and `validate(action)` checks a concrete target, so face-targeting Tarots don't blow up the action list. The Fog needs a masked `getView()` for the UI.
- **Saves:** plain JSON `{schemaVersion, engineVersion, seed, snapshot, actions}`. Continue loads the snapshot; replay needs the same engine version. Storage goes behind a two-function interface (web: localStorage; app: Capacitor Preferences or Filesystem, since iOS can evict WebView storage).
- **Big numbers:** use floats and e-notation display in deep endless; no bignum library.
- **Keep it small:** pnpm workspaces only (no Turborepo or Nx); the sim starts as a script and splits into a package when it grows; no undo in v1.

### 11.2 Rule edge cases (resolved defaults)

1. "Contains a Pair" (Twin Dice, Double Down) checks the scored combo's dice. Full House and Two Pair contain a Pair; Four of a Kind contains Three of a Kind and a Pair.
2. A Stone face has no value or parity. It never forms or breaks a combo by itself and always scores when selected.
3. A Wild face is debuffed by both The Odd One and The Even One.
4. Two separate terms. **Last hand** = the last remaining hand of the blind (Last Call). **Closing hand** = whichever hand ends the blind (Gold).
5. Glass can't shatter a face (only its sticker), so a die is never left with zero faces.
6. Retriggers re-roll Lucky's chances. Glass is checked once per scoring.
7. The Mirror copies value + sticker. The Mold copies value + sticker and overwrites the target's sticker.
8. Short Ladder Parity with 4 matching dice: a selected 5th die is played but doesn't score; an unselected 5th die is unscored (Steel triggers).
9. Ties (High Die, duplicate values in a straight): the leftmost die scores.
10. Rusted Lock dice roll on the free roll, then can't be rerolled.
11. The Wall (4×) and Velvet Rope (6×) multiply the ante base, not the normal Boss target.
12. Steady Hand counts a die that was locked during at least one reroll this hand.
13. Hot Streak and Encore persist for the whole run.
14. Under The Eye / The Mouth, the UI flags an illegal combo; if it's confirmed anyway, the hand scores 0.
15. The face-down die under The Fog can be locked.
16. Pip Counter counts Stone faces as 0.
17. The Forge on a 10 or The Sun on an even face are greyed out (no effect).

## 12. IP and naming

No Balatro code, art, names or text is copied. Mechanics are reimplemented from public documentation; game mechanics aren't copyrightable, but names/art/trade dress are. Every Joker, Tarot, boss and item has an original name (the "Inspired by" columns are internal reference only and are not shown in game). Original art and audio are needed before publishing.

## 13. Decisions log

| # | Question | Decision |
|---|---|---|
| Q1 | Hands / reroll pool per blind | 4 hands / 10 rerolls for now; can change |
| Q2 | Is Parity too easy? | Yes, so it's worth "half a flush": Parity 20×2, Parity House 50×5 |
| Q3 | Face value chips smaller than Balatro's | Fine; point values will be tuned |
| Q4 | Minimum faces per die | 1 |
| Q5 | Face values above 10? | No, cap at 10 |
| Q6 | Bag of >5 dice | Yes, only via a very rare Joker or upgrade |
| Q7 | Name | Dicetro |
| Q8 | How a combo is chosen | Player taps dice; combo name + score shown live; highest-ranked combo in the selection scores |
| Q9 | 5 or 6 starting dice | 5; 6th die = very rare upgrade |
| Q10 | Ante 1 targets | 300 / 400 / 500 (tunable) |
| Q11 | Chiselling breaks the game | Keep min 1; removal Tarots rare + expensive; 5K 100×10; The Spindle boss |
| Q12 | Review fixes | Applied combo values, boss fixes, build fixes, engine architecture (§11.1), edge cases (§11.2) |
