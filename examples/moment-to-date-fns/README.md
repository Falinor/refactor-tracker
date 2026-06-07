# Moment → date-fns

Tracks the migration off `moment` (~290 kB minified) onto `date-fns` (tree-shakeable, smaller).

## Run it

```bash
cd examples/moment-to-date-fns
pnpm dlx refactor-tracker
```

## What it tracks

- **`remaining`** — files still importing `moment`
- **`done`** — files already using `date-fns`

`total` is computed as `done + remaining`.

## Expected output

This example ships with 4 files; 2 use `moment`, 2 use `date-fns`:

```
moment-to-date-fns
└── 50.0% · done 2 / 4
```

Rewrite `src/formatDate.ts` to use `date-fns` and rerun — both numbers move.
