import { newRun } from '@dicetro/engine';
import { expect, it } from 'vitest';
import { bestPlay, keepFor, playEpisode } from '../src/bot';

function dice(s: ReturnType<typeof newRun>, vs: number[]) {
  s.dice = vs.map((value, i) => ({ id: `d${i}`, faces: [{ id: `d${i}x`, value }] }));
  s.shown = s.dice.map((d) => d.faces[0].id);
  return s;
}

it('keeps the biggest group, both pairs, or a straight draw', () => {
  expect(keepFor(dice(newRun('k'), [5, 5, 5, 2, 9]))).toEqual([0, 1, 2]);
  expect(keepFor(dice(newRun('k'), [4, 9, 4, 9, 1]))).toEqual([1, 3, 0, 2]);
  expect(keepFor(dice(newRun('k'), [3, 4, 5, 6, 10])).sort()).toEqual([0, 1, 2, 3]);
});

it('bestPlay finds the full house over the pair inside it', () => {
  expect(bestPlay(dice(newRun('b'), [7, 7, 7, 2, 2])).dice).toEqual([0, 1, 2, 3, 4]);
});

it('plays a full episode to a terminal state, deterministically', () => {
  const a = playEpisode('t-1');
  expect(['won', 'lost']).toContain(a.end);
  expect(playEpisode('t-1')).toEqual(a);
});
