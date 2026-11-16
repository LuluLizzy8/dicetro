# Dicetro — Initial Project Plan (G1)

Owner: Elizabeth Lu (Producer role). Solo project. This plan moves into Asana after G1.

## Gates and milestones

Dates are estimates built back from a final due around **12/10**. **[open: confirm every date against the syllabus]**

| Date (2026) | Gate / milestone | What must exist |
|---|---|---|
| Mon 11/17 | **G1 Concept** | Pitch recording, Initial GDD (`docs/GDD.md`), Initial Configuration (`docs/CONFIG.md`), this plan |
| Fri 11/28 | **G2 Prototype + G3 Production** (combined review) | Playable build with the Pit Boss and scripted baseline, at least 1 external playtest, Initial Playtest Log, Update GDD/Config, Final plan (scope lock) |
| Wed 12/3 | Alpha | All agreed features integrated; known gaps listed |
| Sun 12/7 | Beta | Content locked; balance, polish and fixes only; second external playtest |
| Wed 12/10 | **G4 Final / Pre-Launch** | Gold build tagged, Final GDD/Config, eval results, release instructions |
| ~12/14 | **G5 Retrospective** | AAR, Final Playtest Log, archive |

Thanksgiving week (11/24–11/28) has reduced capacity, which is why G2 tasks are front-loaded.

## First tasks, through G2

| # | Task / outcome | Role | Depends on | Estimate | Acceptance criteria |
|---|---|---|---|---|---|
| 1 | Configure production agents in `.claude/agents/` | Producer | — | 0.5 d | One file per role in CONFIG.md §2; each role used at least once |
| 2 | `agentView(state)` snapshot | Tech Lead | — | 0.5 d | A unit test proves no seed, RNG, future-roll or shop-stock fields |
| 3 | Challenge catalog (~15 templates) + bet tracker + stakes | Design → Tech | 2 | 1.5 d | Each template has a unit test; Side Job loss is −$1 and High Stakes loss is −$5 at cash-out |
| 4 | Scripted baseline offer | Tech Lead | 3 | 0.5 d | Same seed gives the same offer; always valid |
| 5 | Difficulty estimator (sim rollouts) | BI / Tech | 3 | 1 d | 200 rollouts in ≤ 300 ms on a laptop browser, or moved to the server (C3) |
| 6 | Pit Boss server function + validation + fallback | Tech Lead | 2, 4, 5 | 1.5 d | Forced-timeout and invalid-JSON tests show the scripted offer; the key exists only server-side |
| 7 | Pit Boss UI (offer card, progress, cash-out line) | Art / Design | 3 | 1 d | Fits the window at 3 sizes; Accept / Decline works by keyboard |
| 8 | Playtest A/B logging (agent vs scripted, randomized per blind) | BI | 6 | 0.5 d | Each offer logs its source, accepted?, result, and fit rating |
| 9 | Balance pass: add ×Mult Jokers, rerun the sim | Design / BI | — | 1 d | Greedy bot clears Ante 4 in ≥ 50% of 300 runs |
| 10 | Six-dice Guandan experiment (GDD O8) | Design / BI | 9 | 0.5 d | Sim report; adopt only if Ante 1 clear rate stays at 60–80% |
| 11 | Live eval suite (50 states, ≤ $1) | QA | 6 | 0.5 d | Report: validity, p95 latency, cost, failures |
| 12 | External playtest + Initial Playtest Log | Design / QA / BI | 7, 8 | 0.5 d | ≥ 1 external player; observations recorded separately from interpretation |
| 13 | Asana setup: tasks, owners, PPP, gate task | Producer | G1 decision | 0.5 d | All tasks above are in Asana with acceptance criteria |

Total ≈ 10 working days before 11/28. Tasks 9 and 10 are cut first if the Pit Boss runs late.

## Initial Risk Register

| Risk | Trigger | Impact / likelihood | Role | Mitigation | Contingency | Next check |
|---|---|---|---|---|---|---|
| If agent offers aren't valid or fast enough by 11/26, the agent hypothesis can't be tested at G2 | Live suite < 90% valid, or p95 > 3 s | High / Medium | Tech Lead | Structured output, prefetch during the shop, small catalog | Ship the scripted baseline; narrow the agent to template choice only | Task 11 |
| If balance stays at a 0% win rate, playtesters quit before the Pit Boss matters | Sim: Ante 4 clear < 50% | High / High | Design Lead | ×Mult Jokers, target tuning | Lower Antes 4–8 targets by 25% | Task 9 |
| If players can't tell agent bets from scripted ones, the hypothesis fails | Fit ratings within 0.5 | Medium / Medium | BI | Within-subject A/B design, enough blinds per player | Report a null result; keep the agent for flavor | Task 12 |
| If solo capacity drops over Thanksgiving, G2 slips | < 50% of tasks done by 11/23 | High / Medium | Producer | Front-load tasks 2–6 | Cut tasks 9–10 and UI polish | Weekly PPP |
| If the API key leaks or costs spike, money is lost | Billing alert, or key found in a client bundle | High / Low | Tech Lead | Server-only key, rate limit, $10 alert | Rotate the key; disable the agent and fall back to scripted | Before deploy |
