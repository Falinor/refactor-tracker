import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  dts: true,
  shims: true,
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
});
