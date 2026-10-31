import { useEffect, useState } from 'react';
import {
  addConsumable, addJoker, apply, boss, COMBO_NAMES, COMBOS, comboBase, consumableInfo, HANDS, InvalidAction, isDebuffed,
  joker, JOKER_IDS, newRun, previewCombo, REROLLS, REWARD, shownFace, tarot, TAROT_IDS, WIN_ANTE,
  type Action, type Event, type RunState, type TargetKind,
} from '@dicetro/engine';
import { ConsumableRow, JokerRow } from './Cards';
import { Die } from './Die';
import { Inspector } from './Inspector';
import { PackView, ShopView } from './Shop';

type CashOut = Extract<Event, { t: 'cashOut' }>;
type Tally = { label: string; level: number; chips: number; mult: number; total?: number };

const BLIND_NAME = { small: 'Small Blind', big: 'Big Blind', boss: 'Boss Blind' } as const;
const ALL = [0, 1, 2, 3, 4];
const NEED: Record<TargetKind, [min: number, max: number]> = {
  none: [0, 0], die: [1, 1], face: [1, 1], twoFaces: [2, 2], upToTwo: [1, 2], dieValue: [1, 1],
};
const TARGET_HINT: Record<TargetKind, string> = {
  none: '',
  die: 'Pick any face on the die to use it on.',
  face: 'Pick a face.',
  twoFaces: 'Pick the face to change, then the face to copy (same die).',
  upToTwo: 'Pick 1 or 2 faces.',
  dieValue: 'Pick a face. Every face with that value on its die is affected.',
};
const DEV = new URLSearchParams(location.search).has('dev');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const newSeed = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => (b % 36).toString(36)).join('').toUpperCase();
const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 });
const anyOf = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)]; // dev panel only

export function App() {
  const [run, setRun] = useState<RunState>(() => newRun(newSeed()));
  const [selected, setSelected] = useState<number[]>([]);
  const [rollIds, setRollIds] = useState(ALL.map(() => 0)); // bump a die's id to replay its tumble
  const [busy, setBusy] = useState(false);
  const [tally, setTally] = useState<Tally | null>(null); // live readout while a hand scores
  const [lit, setLit] = useState<number | null>(null);
  const [firing, setFiring] = useState<string | null>(null); // uid of the joker currently triggering
  const [cash, setCash] = useState<CashOut | null>(null);
  const [pickedJoker, setPickedJoker] = useState<number | null>(null);
  const [pickedCons, setPickedCons] = useState<number | null>(null);
  const [targetFaces, setTargetFaces] = useState<string[]>([]);
  const [pickedOption, setPickedOption] = useState<number | null>(null); // open pack option
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const faces = ALL.map((i) => shownFace(run, i));
  const rolling = run.phase === 'rolling' && !busy;
  const managing = (run.phase === 'rolling' || run.phase === 'cleared' || run.phase === 'shop') && !busy;
  const cons = pickedCons === null ? null : run.consumables[pickedCons];
  const consInfo = cons ? consumableInfo(cons) : null;
  const packOpt = run.phase === 'pack' && pickedOption !== null ? run.pack!.options[pickedOption] : null;
  // Faces to pick, for a held Tarot or a Tarot chosen from an open pack.
  const targetKind: TargetKind | null = consInfo?.target ?? (packOpt?.kind === 'tarot' ? tarot(packOpt.id).target : null);
  const [minT, maxT] = targetKind ? NEED[targetKind] : [0, 0];
  const targeting = maxT > 0;
  const bossDef = boss(run.boss);

  // Balatro-style preview of the selection: combo name, level, base chips x mult.
  const previewed = selected.length && !tally ? previewCombo(run, selected) : null;
  const preview: Tally | null = tally
    ?? (previewed ? { label: COMBO_NAMES[previewed], level: run.levels[previewed], ...comboBase(previewed, run.levels[previewed]) } : null);

  const bump = (idx: number[]) => setRollIds((ids) => ids.map((n, i) => (idx.includes(i) ? n + 1 : n)));
  const toggle = (i: number) => rolling && setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
  const clearPicks = () => { setPickedJoker(null); setPickedCons(null); setPickedOption(null); setTargetFaces([]); };

  /** Applies a management action; shows the engine's reason if it refuses. */
  function act(action: Action) {
    try {
      const { state, events } = apply(run, action);
      bump(ALL.filter((i) => state.shown[i] !== run.shown[i]));
      setRun(state);
      clearPicks();
      for (const e of events) {
        if (e.t === 'used') setToast(`Used ${e.name}`);
        if (e.t === 'sold') setToast(`Sold ${e.name} for $${e.money}`);
      }
    } catch (err) {
      if (err instanceof InvalidAction) setToast(err.message);
      else throw err;
    }
  }

  async function play() {
    if (!rolling || !selected.length) return;
    const { state, events } = apply(run, { t: 'score', dice: selected });
    const scored = events.find((e) => e.t === 'scored') as Extract<Event, { t: 'scored' }>;
    setBusy(true);
    clearPicks();
    for (const st of scored.steps) {
      if (st.t === 'base') {
        setTally({ label: COMBO_NAMES[st.combo], level: run.levels[st.combo], chips: st.chips, mult: st.mult });
        await sleep(420);
        continue;
      }
      if (st.src === 'shatter') { setToast('A Glass sticker shattered'); continue; }
      setLit(st.die ?? null);
      setFiring(st.src.startsWith('joker:') ? st.src.slice(6) : null);
      setTally((t) => t && { ...t, chips: t.chips + (st.chips ?? 0), mult: (t.mult + (st.mult ?? 0)) * (st.xmult ?? 1) });
      if (st.money) setToast(`Lucky! +$${st.money}`);
      await sleep(st.die === undefined ? 420 : 280);
    }
    setLit(null);
    setFiring(null);
    setTally((t) => t && { ...t, total: scored.total });
    await sleep(750);
    setRun(state);
    setSelected([]);
    setTally(null);
    if (events.some((e) => e.t === 'rolled')) bump(ALL);
    setCash((events.find((e) => e.t === 'cashOut') as CashOut | undefined) ?? null);
    const broke = events.find((e) => e.t === 'jokerDestroyed');
    if (broke && broke.t === 'jokerDestroyed') setToast(`${joker(broke.id).name} broke!`);
    setBusy(false);
  }

  function reroll() {
    if (!rolling || !selected.length || run.rerollsLeft === 0) return;
    act({ t: 'reroll', keep: ALL.filter((i) => !selected.includes(i)) });
    setSelected([]);
  }

  function advance(t: 'next' | 'endless') {
    act({ t });
    setCash(null);
    if (run.phase === 'shop') bump(ALL);
  }

  function restart() {
    setRun(newRun(newSeed()));
    setSelected([]);
    setCash(null);
    clearPicks();
    bump(ALL);
  }

  function pickFace(id: string) {
    setTargetFaces((p) => {
      if (p.includes(id)) return p.filter((x) => x !== id);
      return p.length < maxT ? [...p, id] : [...p.slice(0, maxT - 1), id];
    });
  }

  function devGive(fn: (s: RunState) => boolean | void) {
    const s = structuredClone(run);
    if (fn(s) === false) setToast('No free slot');
    setRun(s);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Escape') clearPicks();
      else if (e.key >= '1' && e.key <= '5') toggle(Number(e.key) - 1);
      else if (e.key === 'Enter' && !targeting) play();
      else if (e.key.toLowerCase() === 'r') reroll();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const progress = Math.min(1, run.score / run.target);

  return (
    <div className="table">
      <aside className="rail">
        <h1 className="brand">Dice<span>tro</span></h1>

        <section className={`blind blind-${run.blind}`}>
          <div className="blind-name">{BLIND_NAME[run.blind]}</div>
          <div className="blind-label">Score at least</div>
          <div className="blind-target">{fmt(run.target)}</div>
          <div className="blind-reward">Reward <b>{'$'.repeat(REWARD[run.blind])}</b></div>
          {run.blind === 'boss'
            ? <div className="boss-now"><b>{bossDef.name}</b>{bossDef.text}</div>
            : <div className="boss-next">Boss: <b>{bossDef.name}</b> · {bossDef.text}</div>}
        </section>

        <section className="round">
          <div className="label">Round score</div>
          <div className="round-score">{fmt(run.score)}</div>
          <div className="meter"><i style={{ width: `${progress * 100}%` }} /></div>
        </section>

        <section className="tally" aria-live="polite">
          <div className="tally-name">
            {preview ? <>{preview.label} <small>lvl {preview.level}</small></> : <span className="dim">Select dice</span>}
          </div>
          <div className="tally-row">
            <span key={`c${preview?.chips}`} className="chips pop">{preview ? fmt(preview.chips) : 0}</span>
            <span className="x">×</span>
            <span key={`m${preview?.mult}`} className="mult pop">{preview ? fmt(preview.mult) : 0}</span>
          </div>
          <div key={tally?.total} className="tally-total">{tally?.total !== undefined && `+${fmt(tally.total)}`}</div>
        </section>

        <section className="counters">
          <div className="counter hands"><b>{run.handsLeft}</b><span>Hands</span></div>
          <div className="counter rerolls"><b>{run.rerollsLeft}</b><span>Rerolls</span></div>
          <div className="counter money"><b>${run.money}</b><span>Money</span></div>
          <div className="counter ante"><b>{run.ante}<small>/{WIN_ANTE}</small></b><span>Ante</span></div>
        </section>

        <footer className="seed">
          <span>Seed <b>{run.seed}</b></span>
          <button className="link" onClick={restart}>New run</button>
        </footer>
      </aside>

      <main className="felt">
        <div className="shelves">
          <JokerRow
            jokers={run.jokers}
            picked={pickedJoker}
            firing={firing}
            disabled={!managing}
            onPick={(i) => { clearPicks(); setPickedJoker(i); }}
            onSell={(i) => act({ t: 'sell', what: 'joker', index: i })}
            onMove={(from, to) => act({ t: 'moveJoker', from, to })}
          />
          <ConsumableRow
            items={run.consumables}
            picked={pickedCons}
            disabled={!managing}
            onPick={(i) => { clearPicks(); setPickedCons(i); }}
          />
        </div>

        {consInfo && pickedCons !== null && (
          <div className="use-bar" role="region" aria-label="Use item">
            <div>
              <b>{consInfo.name}</b>
              <span>{targeting ? TARGET_HINT[consInfo.target] : consInfo.text}</span>
            </div>
            <button
              className="btn small play"
              disabled={targetFaces.length < minT}
              onClick={() => act({ t: 'use', slot: pickedCons, target: { faces: targetFaces } })}
            >Use</button>
            <button className="btn small ghost" onClick={() => act({ t: 'sell', what: 'consumable', index: pickedCons })}>
              Sell ${Math.max(1, Math.floor(consInfo.cost / 2))}
            </button>
            <button className="link" onClick={clearPicks}>Cancel</button>
          </div>
        )}

        {run.phase === 'shop' && (
          <ShopView
            run={run}
            onBuy={(what, slot) => act({ t: 'buy', what, slot })}
            onReroll={() => act({ t: 'rerollShop' })}
            onLeave={() => advance('next')}
          />
        )}
        {run.phase === 'pack' && run.pack && (
          <PackView
            pack={run.pack}
            run={run}
            picked={pickedOption}
            hint={targeting && targetKind ? TARGET_HINT[targetKind] : null}
            canUse={targetFaces.length >= minT}
            onPick={(i) => { setPickedOption(i); setTargetFaces([]); }}
            onTake={(replace) => act({ t: 'pick', index: pickedOption!, replace, target: { faces: targetFaces } })}
            onSkip={() => act({ t: 'skipPack' })}
          />
        )}

        {run.phase !== 'shop' && run.phase !== 'pack' && (
          <>
            <div className="tray">
              {faces.map((f, i) => (
                <Die
                  key={i}
                  index={i}
                  face={f}
                  selected={selected.includes(i)}
                  lit={lit === i}
                  rusted={run.locked.includes(i)}
                  debuffed={run.phase === 'rolling' && isDebuffed(run, i)}
                  rollId={rollIds[i]}
                  disabled={!rolling}
                  onToggle={() => toggle(i)}
                />
              ))}
            </div>

            <div className="actions">
              <button className="btn play" onClick={play} disabled={!rolling || !selected.length}>
                Play <small>Enter</small>
              </button>
              <button className="btn reroll" onClick={reroll} disabled={!rolling || !selected.length || run.rerollsLeft === 0}>
                Reroll <small>R</small>
              </button>
            </div>
            <p className="hint">
              Tap dice (or keys 1–5) to select. <b>Play</b> scores the selection. <b>Reroll</b> rerolls it.
              {' '}{HANDS} hands and {REROLLS} rerolls per blind.
            </p>
          </>
        )}

        <Inspector dice={run.dice} shown={run.shown} targeting={targeting} picked={targetFaces} onPick={pickFace} />
      </main>

      <aside className="combos">
        <h2>Combos</h2>
        <ol>
          {COMBOS.map((c) => {
            const b = comboBase(c, run.levels[c]);
            return (
              <li key={c} className={previewed === c ? 'on' : ''}>
                <span className="lvl">{run.levels[c]}</span>
                <span className="cname">{COMBO_NAMES[c]}</span>
                <span className="cval"><i className="c">{b.chips}</i>×<i className="m">{b.mult}</i></span>
              </li>
            );
          })}
        </ol>
      </aside>

      {toast && <div className="toast" role="status">{toast}</div>}

      {DEV && (
        <div className="dev">
          <b>dev</b>
          <button onClick={() => devGive((s) => addJoker(s, anyOf(JOKER_IDS)))}>+Joker</button>
          <button onClick={() => devGive((s) => addConsumable(s, { kind: 'tarot', id: anyOf(TAROT_IDS) }))}>+Tarot</button>
          <button onClick={() => devGive((s) => addConsumable(s, { kind: 'weight', combo: anyOf(COMBOS) }))}>+Weight</button>
          <button onClick={() => devGive((s) => { s.money += 10; })}>+$10</button>
          <button onClick={() => devGive((s) => { s.score = Math.max(s.score, s.target - 1); })}>Almost win</button>
        </div>
      )}

      {(run.phase === 'cleared' || run.phase === 'won' || run.phase === 'lost') && !busy && (
        <div className="overlay" role="dialog" aria-modal="true">
          {run.phase === 'cleared' && (
            <div className="card">
              <h2>Blind cleared</h2>
              {cash && (
                <ul className="payout">
                  <li><span>{BLIND_NAME[run.blind]}</span><b>${cash.reward}</b></li>
                  <li><span>{cash.handBonus} unused hand{cash.handBonus === 1 ? '' : 's'}</span><b>${cash.handBonus}</b></li>
                  <li><span>Interest</span><b>${cash.interest}</b></li>
                  {cash.extra > 0 && <li><span>Gold &amp; Jokers</span><b>${cash.extra}</b></li>}
                </ul>
              )}
              <button className="btn play" onClick={() => advance('next')} autoFocus>Go to shop</button>
            </div>
          )}
          {run.phase === 'won' && (
            <div className="card win">
              <h2>You beat Ante {WIN_ANTE}</h2>
              <p>The house is broke. Keep rolling?</p>
              <button className="btn play" onClick={() => advance('endless')} autoFocus>Endless mode</button>
              <button className="link" onClick={restart}>New run</button>
            </div>
          )}
          {run.phase === 'lost' && (
            <div className="card lose">
              <h2>Bust</h2>
              <p>Ante {run.ante}, {BLIND_NAME[run.blind]}: {fmt(run.score)} / {fmt(run.target)}</p>
              <button className="btn play" onClick={restart} autoFocus>New run</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
