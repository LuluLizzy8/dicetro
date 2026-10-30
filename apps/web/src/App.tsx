import { useEffect, useState } from 'react';
import {
  apply, COMBO_NAMES, COMBOS, comboBase, detect, HANDS, newRun, REROLLS, REWARD, values, WIN_ANTE,
  type Event, type RunState,
} from '@dicetro/engine';
import { Die } from './Die';

type CashOut = Extract<Event, { t: 'cashOut' }>;
type Tally = { label: string; level: number; chips: number; mult: number; total?: number };

const BLIND_NAME = { small: 'Small Blind', big: 'Big Blind', boss: 'Boss Blind' } as const;
const ALL = [0, 1, 2, 3, 4];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const newSeed = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => (b % 36).toString(36)).join('').toUpperCase();
const fmt = (n: number) => n.toLocaleString('en-US');

export function App() {
  const [run, setRun] = useState<RunState>(() => newRun(newSeed()));
  const [selected, setSelected] = useState<number[]>([]);
  const [rollIds, setRollIds] = useState(ALL.map(() => 0)); // bump a die's id to replay its tumble
  const [busy, setBusy] = useState(false);
  const [tally, setTally] = useState<Tally | null>(null); // live readout while a hand scores
  const [lit, setLit] = useState<number | null>(null);
  const [cash, setCash] = useState<CashOut | null>(null);

  const vals = values(run);
  const rolling = run.phase === 'rolling' && !busy;

  // Balatro-style preview of the selection: combo name, level, base chips x mult.
  const preview: Tally | null = (() => {
    if (tally) return tally;
    if (!selected.length) return null;
    const { combo } = detect(selected.map((i) => vals[i]));
    return { label: COMBO_NAMES[combo], level: run.levels[combo], ...comboBase(combo, run.levels[combo]) };
  })();
  const previewCombo = selected.length && !tally ? detect(selected.map((i) => vals[i])).combo : null;

  const bump = (idx: number[]) => setRollIds((ids) => ids.map((n, i) => (idx.includes(i) ? n + 1 : n)));
  const toggle = (i: number) => rolling && setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));

  async function play() {
    if (!rolling || !selected.length) return;
    const { state, events } = apply(run, { t: 'score', dice: selected });
    const scored = events.find((e) => e.t === 'scored') as Extract<Event, { t: 'scored' }>;
    setBusy(true);
    for (const st of scored.steps) {
      if (st.t === 'base') {
        setTally({ label: COMBO_NAMES[st.combo], level: run.levels[st.combo], chips: st.chips, mult: st.mult });
        await sleep(420);
      } else {
        setLit(st.index);
        setTally((t) => t && { ...t, chips: t.chips + st.chips });
        await sleep(300);
      }
    }
    setLit(null);
    setTally((t) => t && { ...t, total: scored.total });
    await sleep(750);
    setRun(state);
    setSelected([]);
    setTally(null);
    if (events.some((e) => e.t === 'rolled')) bump(ALL);
    setCash((events.find((e) => e.t === 'cashOut') as CashOut | undefined) ?? null);
    setBusy(false);
  }

  function reroll() {
    if (!rolling || !selected.length || run.rerollsLeft === 0) return;
    const { state } = apply(run, { t: 'reroll', keep: ALL.filter((i) => !selected.includes(i)) });
    setRun(state);
    bump(selected);
    setSelected([]);
  }

  function advance(t: 'next' | 'endless') {
    setRun(apply(run, { t }).state);
    setCash(null);
    bump(ALL);
  }

  function restart() {
    setRun(newRun(newSeed()));
    setSelected([]);
    setCash(null);
    bump(ALL);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key >= '1' && e.key <= '5') toggle(Number(e.key) - 1);
      else if (e.key === 'Enter') play();
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
        <div className="tray">
          {vals.map((v, i) => (
            <Die
              key={i}
              index={i}
              value={v}
              selected={selected.includes(i)}
              lit={lit === i}
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
      </main>

      <aside className="combos">
        <h2>Combos</h2>
        <ol>
          {COMBOS.map((c) => {
            const b = comboBase(c, run.levels[c]);
            return (
              <li key={c} className={previewCombo === c ? 'on' : ''}>
                <span className="lvl">{run.levels[c]}</span>
                <span className="cname">{COMBO_NAMES[c]}</span>
                <span className="cval"><i className="c">{b.chips}</i>×<i className="m">{b.mult}</i></span>
              </li>
            );
          })}
        </ol>
      </aside>

      {run.phase !== 'rolling' && !busy && (
        <div className="overlay" role="dialog" aria-modal="true">
          {run.phase === 'cleared' && (
            <div className="card">
              <h2>Blind cleared</h2>
              {cash && (
                <ul className="payout">
                  <li><span>{BLIND_NAME[run.blind]}</span><b>${cash.reward}</b></li>
                  <li><span>{cash.handBonus} unused hand{cash.handBonus === 1 ? '' : 's'}</span><b>${cash.handBonus}</b></li>
                  <li><span>Interest</span><b>${cash.interest}</b></li>
                </ul>
              )}
              <button className="btn play" onClick={() => advance('next')} autoFocus>Next blind</button>
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
