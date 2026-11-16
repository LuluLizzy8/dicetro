# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Players who like short-session strategy roguelikes (Balatro, Slay the Spire, Luck be a Landlord), and casual Yahtzee players curious about roguelikes. They play 30–45 minute runs in a browser tab; a phone version is planned later.

## Product Purpose

Dicetro is a single-player roguelike dice game. You roll five dice Yahtzee-style, score them Balatro-style (chips × mult), and survive escalating blinds with Jokers, a shop, Tarots that reshape your dice, and boss blinds. Clear Ante 8 to win, then continue in endless mode. Success is the player discovering a build that breaks the game, and wanting "one more run."

## Positioning

The dice are the deck: every upgrade edits the dice themselves (remove faces, copy faces, sticker faces, swap whole dice), instead of editing a deck of cards. An AI Pit Boss offers one side bet per blind, fitted to the player's build and habits.

## Operating Context

- A solo student project in a course on AI-assisted game development. It moves through gates G1–G5 (GDD: `docs/GDD.md`; plan: `docs/PROJECT_PLAN.md`; agent config: `docs/CONFIG.md`).
- Live build: https://dicetro.vercel.app. Runs save automatically and resume after a refresh.
- Playtests compare the agent's bets with a scripted baseline.

## Capabilities and Constraints

- The engine is pure and deterministic: seeded RNG, the same seed and actions replay identically. The UI only renders engine state and events.
- The main game screen fits the window with no page scroll; on phones the combo and dice-faces panel opens from the bottom.
- The Pit Boss agent is planned, not built (GDD §14).
- Undecided: audio, and the final balance numbers.

## Brand Commitments

- Name: Dicetro.
- Mechanics are inspired by Balatro and Yahtzee, but no Balatro code, art, names or text are used. Every Joker, Tarot and boss has an original name.
- Fonts Bowlby One and Martian Mono (SIL OFL).

## Evidence on Hand

- Working game with 21 Jokers, 12 Tarots, 11 Weights and 8 bosses; 102 tests; CI.
- Balance reports from the sim bot (`npm run sim`).
- No playtest results, testimonials or player numbers yet. Do not invent any.

## Product Principles

1. Build your own deck: dice, combo upgrades and Jokers together.
2. Bend your luck: rolls are random, but choices change the odds.
3. Break the house: builds can snowball.
4. Short, replayable runs.

## Accessibility & Inclusion

Full keyboard play: every action must be possible without a mouse.
