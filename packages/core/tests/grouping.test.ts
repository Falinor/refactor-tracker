import { describe, it, expect } from 'vitest';
import { groupTasksByTag } from '../src/grouping.js';
import type { TaskResult } from '../src/types.js';

function task(id: string, tags?: string[]): TaskResult {
  return {
    id,
    name: id,
    done: 0,
    total: 1,
    percentage: 0,
    delta: null,
    ...(tags ? { tags } : {}),
    registeredAt: null,
    completedAt: null,
    durationDays: null,
  };
}

describe('groupTasksByTag', () => {
  it('returns a single null group when no task has tags', () => {
    const groups = groupTasksByTag([task('a'), task('b')]);
    expect(groups).toEqual([{ tag: null, tasks: [task('a'), task('b')] }]);
  });

  it('orders groups by the first appearance of each tag', () => {
    const tasks = [task('a', ['x']), task('b', ['y']), task('c', ['x'])];
    const groups = groupTasksByTag(tasks);
    expect(groups.map((g) => g.tag)).toEqual(['x', 'y']);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['a', 'c']);
    expect(groups[1].tasks.map((t) => t.id)).toEqual(['b']);
  });

  it('places a task with multiple tags in every matching group', () => {
    const t = task('multi', ['x', 'y']);
    const groups = groupTasksByTag([t]);
    expect(groups.map((g) => g.tag)).toEqual(['x', 'y']);
    expect(groups[0].tasks[0]).toBe(t);
    expect(groups[1].tasks[0]).toBe(t);
  });

  it('puts untagged tasks into a trailing null group', () => {
    const groups = groupTasksByTag([task('a', ['x']), task('b'), task('c', ['x'])]);
    expect(groups.map((g) => g.tag)).toEqual(['x', null]);
    expect(groups[1].tasks.map((t) => t.id)).toEqual(['b']);
  });

  it('treats an empty tags array as untagged', () => {
    const groups = groupTasksByTag([task('a', []), task('b', ['x'])]);
    expect(groups.map((g) => g.tag)).toEqual(['x', null]);
    expect(groups[1].tasks.map((t) => t.id)).toEqual(['a']);
  });
});
