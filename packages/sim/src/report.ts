import type { Episode } from './bot';

export const BLIND_NAMES_FOR_REPORT = ['small', 'big', 'boss'] as const;
const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(0)}%` : '-');

/** Plain-text summary: win rate, where runs end, clear rate per blind, and Jokers in deep runs. */
export function report(eps: Episode[], policy: string, ms: number): string {
  const lines: string[] = [];
  const wins = eps.filter((e) => e.won).length;
  const avgAnte = eps.reduce((n, e) => n + e.ante, 0) / eps.length;
  lines.push(`policy=${policy} runs=${eps.length} time=${(ms / 1000).toFixed(1)}s`);
  lines.push(`win rate (clear Ante 8): ${pct(wins, eps.length)}   avg ante reached: ${avgAnte.toFixed(2)}   step-limit: ${eps.filter((e) => e.end === 'step-limit').length}`);

  lines.push('', 'clear rate per blind (of runs that reached it):');
  for (let ante = 1; ante <= 8; ante++) {
    const row = BLIND_NAMES_FOR_REPORT.map((b) => {
      const key = `${ante}-${b}`;
      const reached = eps.filter((e) => e.cleared.includes(key) || (e.ante === ante && e.blind === b)).length;
      const done = eps.filter((e) => e.cleared.includes(key)).length;
      return `${b.padEnd(5)} ${pct(done, reached).padStart(4)} (${reached})`;
    });
    lines.push(`  ante ${ante}: ${row.join('   ')}`);
  }

  const counts = new Map<string, { n: number; ante: number }>();
  for (const e of eps) for (const j of e.jokers) {
    const c = counts.get(j) ?? { n: 0, ante: 0 };
    counts.set(j, { n: c.n + 1, ante: c.ante + e.ante });
  }
  if (counts.size) {
    lines.push('', 'jokers held at end of run (count, avg ante reached when held):');
    for (const [j, c] of [...counts].sort((a, b) => b[1].ante / b[1].n - a[1].ante / a[1].n)) {
      lines.push(`  ${j.padEnd(14)} ${String(c.n).padStart(4)}   ${(c.ante / c.n).toFixed(2)}`);
    }
  }
  return lines.join('\n');
}
