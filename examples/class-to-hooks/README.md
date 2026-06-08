# React class components → hooks

Tracks the migration from `React.Component` classes to functional components with hooks.

## Run it

```bash
cd examples/class-to-hooks
pnpm dlx refactor-tracker
```

## What it tracks

- **`remaining`** — components still extending `React.Component` (or imported `Component`)
- **`total`** — total `.tsx` files under `src/`
- **`done`** — computed as `total - remaining`

## Expected output

This example ships with 4 components; 2 are class-based, 2 are functional:

```
class-to-hooks
└── 50.0% · done 2 / 4
```

Convert `src/Header.tsx` from a class to a function and the next run reports a `+1` delta.
