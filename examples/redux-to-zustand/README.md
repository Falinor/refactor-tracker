# Redux → Zustand

Tracks the migration off Redux (with `react-redux` bindings) onto Zustand — smaller bundle, no boilerplate reducers.

## Run it

```bash
cd examples/redux-to-zustand
pnpm dlx refactor-tracker
```

## What it tracks

- **`remaining`** — store files still importing from `react-redux` or `@reduxjs/toolkit`
- **`done`** — store files already using `zustand`

## Expected output

This example ships with 4 stores; 2 use Redux, 2 use Zustand:

```
redux-to-zustand
└── 50.0% · done 2 / 4
```
