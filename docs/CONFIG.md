# Dicetro — Configuration Document (Initial, G1)

Owner: Elizabeth Lu (Design Lead / Tech Lead roles; Creative Director approval). Gate Approver: instructor.

Every item carries a status label:
- **[planned]**: designed, not built.
- **[implemented]**: in the repo.
- **[verified]**: covered by a passing test or a recorded run.
- **[open]**: unresolved.

Game design lives in `docs/GDD.md` (the GDD; agent design is in §14). The plan and risks live in `docs/PROJECT_PLAN.md`.

## 1. In-game agent: The Pit Boss **[planned]**

| Field | Value |
|---|---|
| Purpose | Offer one side bet per blind that fits this player's build and habits (GDD §14). |
| Executable artifact | Function-calling interface: Vercel Function `apps/web/api/pitboss.ts`, with manifest `agents/pit-boss/manifest.json` **[planned]**. Manifest fields follow the syllabus **[open: confirm required fields]**. |
| Model / settings | `claude-haiku-5-5`, effort `low`, `max_tokens` 1024. Output: structured JSON (`output_config.format`) using the schema `{template, params, kind, flavor}`. |
| Prompt | `agents/pit-boss/system.md`: Pit Boss persona, the challenge catalog, and the rules. Versioned in git. |
| Tools | None. One call returns one structured offer, so there is no tool loop. |
| Context sources | `agentView(state)` in `packages/engine/src/agentView.ts`. It is a read-only snapshot of ante, blind, target, boss, dice faces and stickers, Jokers, combo levels, money, hands and rerolls, plus a play summary: top 3 combos, bet accept and fail rates, last 3 bets. |
| Knowledge boundary | The snapshot **excludes** the seed, RNG stream state, future rolls, unrevealed shop stock and The Fog's face-down die. Enforced by building the view from an allow-list and checked by a unit test. |
| Permitted actions | Choose 1 template from the catalog (~15), its parameters within ranges, the offer type, and ≤ 120 characters of flavor text. |
| Prohibited actions | Changing rules, targets, dice, RNG or prices; setting the reward; making more than one offer per blind; free-form state changes. The engine validates every field. |
| Validation | Schema check → parameter ranges → about 200 sim-bot rollouts of the next blind → success chance inside the band for its type (Side Job 50–70%, High Stakes 10–25%) → the engine prices the reward → flavor text passes the length check and blocked-word filter. |
| Failure modes | Timeout, API error, refusal, invalid JSON, parameters out of range, difficulty outside the band, flavor text failing the filter, rate limit. |
| Fallback | The scripted baseline: a random catalog template with random valid parameters, engine pricing and canned flavor text. It also runs when the Pit Boss is off. |
| Timeout / retry | 5 s timeout, no retry. A call starts at cash-out, so the offer is ready before the next blind. |
| Spending limits | Up to 40 calls per run; a per-IP rate limit of 60 calls per hour; a monthly budget alert at $10. Expected cost is about $0.02 per run (GDD §14.6). |
| Memory policy | No memory across runs. The play summary comes from the current save only. No personal data is sent. |
| Logging | One trace per call with the run seed, blind, model and prompt version, latency, tokens, validation result and fallback reason. No API key or player identity is logged. |
| Human override | A Settings toggle turns the Pit Boss off. The `?dev` panel can force the scripted baseline or the agent, for playtests. |
| Secrets | `ANTHROPIC_API_KEY` is a Vercel environment variable, only on the server. It is never in client code or git. |

### 1.1 Evaluation **[planned]**

| Suite | Type | Pass criteria |
|---|---|---|
| `agentView` leak test | Deterministic (Vitest) | The snapshot has no RNG, seed, future-roll or shop-stock fields |
| Validator tests | Deterministic | Bad schema, out-of-range parameters and off-band difficulty are each rejected and fall back |
| Forced timeout / API error | Deterministic (mocked) | The scripted offer appears, the blind state is unchanged, and the trace records the fallback |
| Live offer suite | Bounded live run, 50 seeded states, ≤ $1 | ≥ 90% of offers pass validation; p95 latency ≤ 3 s; the cost per offer is logged; failed and unavailable runs are reported |
| Fit rating | Human (playtest) | Players rate agent offers vs scripted offers on "fit my run" (1–5) |

Commands:
- `npm test`: all deterministic tests. **[implemented]** for the engine (102 tests).
- `npm run eval:pitboss`: the live suite. **[planned]**

CI: `.github/workflows/ci.yml` runs typecheck, tests and build on every push. **[verified]**

## 2. Production agent team: role coverage **[planned]**

All roles use Claude Code subagents (`claude-opus-5-5`, a shared model). Each subagent's executable config lives in `.claude/agents/<role>.md` **[planned]**. Every role can read the repo; the write permissions below are each role's limit. Human approval boundary for every role: I (Executive Producer / Creative Director) accept every deliverable, and only the instructor approves gates.

| Role | Executable artifact | Purpose | Context | Tools / permissions | Outputs | Recipient and handoff | Evaluation | Human approval boundary |
|---|---|---|---|---|---|---|---|---|
| Producer | `.claude/agents/producer.md` | Plan, scope, risks, weekly PPP | GDD, plan, git log, Asana export | Read repo; write `docs/PROJECT_PLAN.md` | Plan updates, PPP, cut proposals | Me: PPP every week | Plan matches the build; dates hold | I approve scope changes |
| Design Lead | `.claude/agents/design-lead.md` | Rules, balance, playtest questions | GDD, sim reports | Read repo; write `docs/GDD.md` | Design specs, playtest questions | Tech Lead: spec with acceptance criteria | Sim targets met; playtest findings | I choose between design options |
| Tech Lead | `.claude/agents/tech-lead.md` | Engine, Pit Boss function, deploy | Repo, CONFIG.md | Edit code; run npm scripts; no prod deploy | PRs, builds, traces | QA: PR + test evidence | CI green; eval suite | I merge, and I deploy to prod |
| Art Lead | `.claude/agents/art-lead.md` | Visual direction, readability | GDD §16, screenshots | Edit `apps/web/src/*.css`, SVG | Visual specs, CSS | Tech Lead / me: screenshots at 3 sizes | Art Direction Peer Review (reader §5.3) | I accept the look |
| Narrative & Audio | `.claude/agents/narrative-audio.md` | Pit Boss voice, canned lines, sound list | GDD §14, §16 | Write `agents/pit-boss/*.md`, audio list | Persona prompt, canned flavor text, SFX list | Tech Lead: prompt + lines | Blocked-word filter; tone review | I approve the persona |
| QA | `.claude/agents/qa.md` | Reproduce bugs, verify fixes, release checks | Build, tests, playtest log | Run tests and Playwright scripts; file issues | Bug reports, verification notes | Tech Lead: repro steps | Each fix has a regression test | I accept known defects |
| BI | `packages/sim` (bot + report) **[implemented]** plus `.claude/agents/bi.md` | Balance data, agent metrics | Sim output, traces, playtest log | Run `npm run sim`; read traces | Win/clear rates, accept rates, cost | Design Lead: sim report with limits | Sample sizes stated | I decide what the data means |
| Publishing & Release | `.claude/agents/release.md` | README, deploy, archive | README, vercel.json | Read repo; preview deploys only | Release notes, instructions | Me: release checklist | Fresh-clone run works | I approve prod deploys and tags |

Evidence so far:
- Design Q&A and architecture reviews were run with Claude Code review agents (decisions log, GDD §13).
- The engine, tests and CI exist.
- `packages/sim` produces balance reports.

## 3. Open configuration questions

| # | Question |
|---|---|
| C1 | Which manifest fields the syllabus requires for the shipped agent artifact |
| C2 | Rate-limit numbers once real traffic is seen |
| C3 | Whether the difficulty estimate (200 rollouts) runs fast enough in the browser or must run on the server |
