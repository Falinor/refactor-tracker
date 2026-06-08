# Mocha → Vitest

Tracks the migration of legacy Mocha (`*.spec.js`) tests onto Vitest (`*.test.ts`).

## Run it

```bash
cd examples/mocha-to-vitest
pnpm dlx refactor-tracker
```

## What it tracks

- **`remaining`** — `*.spec.js` files under `tests/` (assumed Mocha)
- **`done`** — `*.test.ts` files under `tests/` (assumed Vitest)

The convention assumes one test file per behavior, so file count is a reasonable proxy. For a real codebase, you might want to scope to per-feature directories or count `describe(` blocks instead.

## Expected output

This example ships with 4 test files; 2 are Mocha, 2 are Vitest:

```
mocha-to-vitest
└── 50.0% · done 2 / 4
```
