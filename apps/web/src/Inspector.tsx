import { STICKER_TEXT, type Die } from '@dicetro/engine';

type Props = {
  dice: Die[];
  shown: string[];
  targeting: boolean;
  picked: string[];
  onPick: (faceId: string) => void;
};

/** Every face of every die. Doubles as the face picker for Tarots. */
export function Inspector({ dice, shown, targeting, picked, onPick }: Props) {
  return (
    <section className={`inspector${targeting ? ' targeting' : ''}`} aria-label="Your dice">
      {dice.map((d, i) => (
        <div key={d.id} className="ins-die">
          <div className="ins-head">Die {i + 1} <span>{d.faces.length}f</span></div>
          <div className="ins-faces">
            {d.faces.map((f) => (
              <button
                key={f.id}
                className={`chip${f.sticker ? ` st-${f.sticker}` : ''}${shown[i] === f.id ? ' showing' : ''}${picked.includes(f.id) ? ' picked' : ''}`}
                disabled={!targeting}
                onClick={() => onPick(f.id)}
                title={f.sticker ? `${f.sticker}: ${STICKER_TEXT[f.sticker]}` : undefined}
                aria-pressed={picked.includes(f.id)}
              >
                {f.sticker === 'stone' ? '◆' : f.value}
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
