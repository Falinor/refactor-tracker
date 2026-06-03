import { describe, expect, it } from 'vitest';
import { parseNotionConfig } from '../src/config.js';

describe('parseNotionConfig', () => {
  it('accepts a complete config', () => {
    const parsed = parseNotionConfig({
      token: 'secret_x',
      databaseId: 'db_1',
      dataSourceId: 'ds_1',
    });
    expect(parsed).toEqual({ token: 'secret_x', databaseId: 'db_1', dataSourceId: 'ds_1' });
  });

  it('rejects missing token', () => {
    expect(() => parseNotionConfig({ databaseId: 'db_1', dataSourceId: 'ds_1' })).toThrow(/token/);
  });

  it('rejects missing databaseId', () => {
    expect(() => parseNotionConfig({ token: 'secret_x', dataSourceId: 'ds_1' })).toThrow(
      /databaseId/,
    );
  });

  it('rejects missing dataSourceId', () => {
    expect(() => parseNotionConfig({ token: 'secret_x', databaseId: 'db_1' })).toThrow(
      /dataSourceId/,
    );
  });

  it('rejects an empty token string', () => {
    expect(() =>
      parseNotionConfig({ token: '', databaseId: 'db_1', dataSourceId: 'ds_1' }),
    ).toThrow(/token/);
  });

  it('rejects non-string fields', () => {
    expect(() =>
      parseNotionConfig({ token: 1, databaseId: 'db_1', dataSourceId: 'ds_1' }),
    ).toThrow();
  });
});
