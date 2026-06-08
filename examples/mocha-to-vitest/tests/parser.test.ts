import { describe, it, expect } from 'vitest';
import { parseQuery } from '../src/parser';

describe('parseQuery', () => {
  it('parses a flat key=value string', () => {
    expect(parseQuery('a=1&b=2')).toEqual({ a: '1', b: '2' });
  });

  it('returns an empty object for an empty input', () => {
    expect(parseQuery('')).toEqual({});
  });
});
