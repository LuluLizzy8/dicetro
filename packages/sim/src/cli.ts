// Usage: npm run sim -- [--runs 300] [--policy greedy|noshop] [--seed sim]
import { playEpisode, type Policy } from './bot';
import { report } from './report';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const runs = Number(arg('runs', '300'));
const policy = arg('policy', 'greedy') as Policy;
const prefix = arg('seed', 'sim');

const t0 = Date.now();
const episodes = Array.from({ length: runs }, (_, i) => playEpisode(`${prefix}-${i}`, policy));
console.log(report(episodes, policy, Date.now() - t0));
