import {
  CONSUMABLE_SLOTS, consumableInfo, JOKER_SLOTS, joker, sellValue,
  type Consumable, type JokerInst,
} from '@dicetro/engine';

type JokerProps = {
  jokers: JokerInst[];
  picked: number | null;
  firing: string | null;
  disabled: boolean;
  onPick: (i: number | null) => void;
  onSell: (i: number) => void;
  onMove: (from: number, to: number) => void;
};

export function JokerRow({ jokers, picked, firing, disabled, onPick, onSell, onMove }: JokerProps) {
  return (
    <section className="shelf jokers" aria-label="Jokers">
      <header>Jokers <span>{jokers.length}/{JOKER_SLOTS}</span></header>
      <div className="slots">
        {jokers.map((j, i) => {
          const d = joker(j.id);
          const on = picked === i;
          return (
            <div key={j.uid} className={`card-wrap${on ? ' on' : ''}`}>
              <button
                className={`jcard r-${d.rarity}${firing === j.uid ? ' fire' : ''}`}
                onClick={() => onPick(on ? null : i)}
                disabled={disabled}
                aria-pressed={on}
              >
                <b>{d.name}</b>
                <span>{d.text}</span>
                {j.id === 'hotStreak' && <em>+{j.state.n} now</em>}
              </button>
              {on && (
                <div className="card-menu">
                  <p className="card-text">{d.text}</p>
                  <button onClick={() => onMove(i, i - 1)} disabled={i === 0} aria-label="Move left">◀</button>
                  <button className="sell" onClick={() => onSell(i)}>Sell ${sellValue(d.cost)}</button>
                  <button onClick={() => onMove(i, i + 1)} disabled={i === jokers.length - 1} aria-label="Move right">▶</button>
                </div>
              )}
            </div>
          );
        })}
        {Array.from({ length: JOKER_SLOTS - jokers.length }, (_, i) => <div key={`e${i}`} className="jcard empty" />)}
      </div>
    </section>
  );
}

type ConsProps = {
  items: Consumable[];
  picked: number | null;
  disabled: boolean;
  onPick: (i: number | null) => void;
};

export function ConsumableRow({ items, picked, disabled, onPick }: ConsProps) {
  return (
    <section className="shelf cons" aria-label="Consumables">
      <header>Items <span>{items.length}/{CONSUMABLE_SLOTS}</span></header>
      <div className="slots">
        {items.map((c, i) => {
          const info = consumableInfo(c);
          return (
            <button
              key={i}
              className={`ccard k-${c.kind}${picked === i ? ' on' : ''}`}
              onClick={() => onPick(picked === i ? null : i)}
              disabled={disabled}
              aria-pressed={picked === i}
            >
              <b>{info.name}</b>
              <span>{info.text}</span>
            </button>
          );
        })}
        {Array.from({ length: CONSUMABLE_SLOTS - items.length }, (_, i) => <div key={`e${i}`} className="ccard empty" />)}
      </div>
    </section>
  );
}
