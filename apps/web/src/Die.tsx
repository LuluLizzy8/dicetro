import { STICKER_TEXT, type Face } from '@dicetro/engine';

type Props = {
  index: number;
  face: Face;
  selected: boolean;
  lit: boolean;
  rusted: boolean; // Rusted Lock: never rerolls this blind
  debuffed: boolean; // boss debuff: scores nothing
  rollId: number;
  disabled: boolean;
  onToggle: () => void;
};

// A d10 seen face-on: pentagonal-trapezohedron silhouette with the kite face toward the player.
export function Die({ index, face, selected, lit, rusted, debuffed, rollId, disabled, onToggle }: Props) {
  const { value, sticker } = face;
  const stone = sticker === 'stone';
  const underline = !stone && (value === 6 || value === 9); // real dice mark 6/9 so they can't be misread
  return (
    <button
      className={`die${selected ? ' sel' : ''}${lit ? ' lit' : ''}${sticker ? ` st-${sticker}` : ''}${rusted ? ' rusted' : ''}${debuffed ? ' debuffed' : ''}`}
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`Die ${index + 1}, showing ${stone ? 'stone' : value}${sticker && !stone ? `, ${sticker}` : ''}${rusted ? ', rusted' : ''}${debuffed ? ', debuffed' : ''}${selected ? ', selected' : ''}`}
      title={sticker ? `${sticker}: ${STICKER_TEXT[sticker]}` : undefined}
    >
      <span key={rollId} className="die-body" style={{ animationDelay: `${index * 55}ms` }}>
        <svg viewBox="0 0 100 110" aria-hidden="true">
          <polygon className="die-side" points="50,3 97,40 86,90 50,107 14,90 3,40" />
          <polygon className="die-kite" points="50,3 80,60 50,76 20,60" />
          <path className="die-edge" d="M20 60 L3 40 M80 60 L97 40 M50 76 L50 107 M20 60 L14 90 M80 60 L86 90" />
          <text x="50" y="50" className="die-num">{stone ? '◆' : value}</text>
          {underline && <line x1="42" y1="65" x2="58" y2="65" className="die-ul" />}
          {sticker && <text x="50" y="92" className="die-tag">{sticker.toUpperCase()}</text>}
        </svg>
      </span>
      {rusted && <span className="die-badge" aria-hidden="true">🔒</span>}
      <kbd>{index + 1}</kbd>
    </button>
  );
}
