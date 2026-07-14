import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  shims: true,
  noExternal: [/.*/],
  outExtensions: () => ({ js: '.js' }),
  outDir: 'dist',
  // GitHub Actions expects dist/index.js as the entrypoint per action.yml
  outputOptions: {
    entryFileNames: 'index.js',
  },
});
