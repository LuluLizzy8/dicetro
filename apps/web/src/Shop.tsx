import {
  consumableInfo, itemCost, joker, PACK_COST, PACK_INFO, STICKER_TEXT,
  type Pack, type PackOption, type RunState, type ShopItem,
} from '@dicetro/engine';

function itemInfo(it: ShopItem) {
  if (it.kind === 'joker') {
    const d = joker(it.id);
    return { name: d.name, text: d.text, tag: d.rarity, cls: `jcard r-${d.rarity}` };
  }
  const c = consumableInfo(it.kind === 'tarot' ? { kind: 'tarot', id: it.id } : { kind: 'weight', combo: it.combo });
  return { name: c.name, text: c.text, tag: it.kind, cls: `ccard k-${it.kind}` };
}

type ShopProps = {
  run: RunState;
  onBuy: (what: 'item' | 'pack', slot: number) => void;
  onReroll: () => void;
  onLeave: () => void;
};

export function ShopView({ run, onBuy, onReroll, onLeave }: ShopProps) {
  const shop = run.shop!;
  return (
    <section className="shop" aria-label="Shop">
      <header className="shop-head">
        <h2>The Shop</h2>
        <div className="shop-ctl">
          <button className="btn small reroll" onClick={onReroll} disabled={run.money < shop.rerollCost}>
            Reroll ${shop.rerollCost}
          </button>
          <button className="btn small play" onClick={onLeave}>Next blind ▸</button>
        </div>
      </header>
      <div className="shop-row">
        {shop.items.map((it, i) => {
          if (!it) return <div key={i} className="ware sold">Sold</div>;
          const info = itemInfo(it);
          const cost = itemCost(it);
          return (
            <div key={i} className="ware">
              <div className={`${info.cls} static`}>
                <b>{info.name}</b>
                <span>{info.text}</span>
                <em className="tag">{info.tag}</em>
              </div>
              <button className="btn small play" onClick={() => onBuy('item', i)} disabled={run.money < cost}>Buy ${cost}</button>
            </div>
          );
        })}
        <div className="shop-sep" aria-hidden="true" />
        {shop.packs.map((k, i) => {
          if (!k) return <div key={`p${i}`} className="ware sold">Opened</div>;
          return (
            <div key={`p${i}`} className="ware">
              <div className={`pack p-${k}`}>
                <b>{PACK_INFO[k].name}</b>
                <span>{PACK_INFO[k].text}</span>
              </div>
              <button className="btn small play" onClick={() => onBuy('pack', i)} disabled={run.money < PACK_COST}>Open ${PACK_COST}</button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function optionInfo(o: PackOption) {
  if (o.kind === 'die') return { name: o.name, text: `${o.die.faces.length} faces` };
  return consumableInfo(o);
}

type PackProps = {
  pack: Pack;
  run: RunState;
  picked: number | null;
  hint: string | null; // targeting hint when the picked option is a Tarot that needs faces
  canUse: boolean;
  onPick: (i: number | null) => void;
  onTake: (replace?: number) => void;
  onSkip: () => void;
};

export function PackView({ pack, run, picked, hint, canUse, onPick, onTake, onSkip }: PackProps) {
  const o = picked === null ? null : pack.options[picked];
  return (
    <section className="shop pack-view" aria-label={PACK_INFO[pack.kind].name}>
      <header className="shop-head">
        <h2>{PACK_INFO[pack.kind].name}</h2>
        <button className="btn small ghost" onClick={onSkip}>Skip</button>
      </header>
      <div className="shop-row">
        {pack.options.map((opt, i) => {
          const info = optionInfo(opt);
          return (
            <button
              key={i}
              className={`option${picked === i ? ' on' : ''}${opt.kind === 'die' ? '' : ` k-${opt.kind}`}`}
              onClick={() => onPick(picked === i ? null : i)}
              aria-pressed={picked === i}
            >
              <b>{info.name}</b>
              <span>{info.text}</span>
              {opt.kind === 'die' && (
                <span className="option-faces">
                  {opt.die.faces.map((f) => (
                    <i key={f.id} className={`chip${f.sticker ? ` st-${f.sticker}` : ''}`} title={f.sticker ? STICKER_TEXT[f.sticker] : undefined}>
                      {f.sticker === 'stone' ? '◆' : f.value}
                    </i>
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {o?.kind === 'die' && (
        <div className="replace">
          <span>Replace which die?</span>
          {run.dice.map((d, i) => (
            <button key={d.id} className="btn small ghost" onClick={() => onTake(i)}>
              Die {i + 1} <small>{d.faces.length}f</small>
            </button>
          ))}
        </div>
      )}
      {o && o.kind !== 'die' && (
        <div className="replace">
          <span>{hint ?? 'Use it now.'}</span>
          <button className="btn small play" onClick={() => onTake()} disabled={!canUse}>Use</button>
        </div>
      )}
    </section>
  );
}
