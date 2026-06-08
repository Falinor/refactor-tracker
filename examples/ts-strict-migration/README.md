# TypeScript strict migration

Tracks adoption of strict typing — counts files still using `any` against the total number of TypeScript files.

## Run it

```bash
cd examples/ts-strict-migration
pnpm dlx refactor-tracker
```

## What it tracks

- **`remaining`** — files containing `: any`, ` as any`, or `<any>` anywhere
- **`total`** — total `.ts` files under `src/`
- **`done`** — computed as `total - remaining`

## Expected output

This example ships with 5 files; 2 still use `any`, 3 are strict:

```
ts-strict
└── 60.0% · done 3 / 5
```

After you remove the `any` from `src/user.ts` and rerun, the cache file (`.refactor-tracker-cache.json`) records the delta and the next report shows `+1`.
