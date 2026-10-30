type Props = {
  index: number;
  value: number;
  selected: boolean;
  lit: boolean;
  rollId: number;
  disabled: boolean;
  onToggle: () => void;
};

// A d10 seen face-on: outer pentagonal-trapezohedron silhouette with the kite face toward the player.
export function Die({ index, value, selected, lit, rollId, disabled, onToggle }: Props) {
  const underline = value === 6 || value === 9; // real dice mark 6/9 so they can't be misread
  return (
    <button
      className={`die${selected ? ' sel' : ''}${lit ? ' lit' : ''}`}
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`Die ${index + 1}, showing ${value}${selected ? ', selected' : ''}`}
    >
      <span key={rollId} className="die-body" style={{ animationDelay: `${index * 55}ms` }}>
        <svg viewBox="0 0 100 110" aria-hidden="true">
          <polygon className="die-side" points="50,3 97,40 86,90 50,107 14,90 3,40" />
          <polygon className="die-kite" points="50,3 80,60 50,76 20,60" />
          <path className="die-edge" d="M20 60 L3 40 M80 60 L97 40 M50 76 L50 107 M20 60 L14 90 M80 60 L86 90" />
          <text x="50" y="52" className="die-num">{value}</text>
          {underline && <line x1="42" y1="67" x2="58" y2="67" className="die-ul" />}
        </svg>
      </span>
      <kbd>{index + 1}</kbd>
    </button>
  );
}
