# CommonJS → ESM

Tracks the migration off CommonJS `require()` onto native ESM `import`/`export`.

## Run it

```bash
cd examples/commonjs-to-esm
pnpm dlx refactor-tracker
```

## What it tracks

- **`remaining`** — files containing `require(`
- **`done`** — files starting a line with `import ` or `export `

## Expected output

This example ships with 5 files; 2 use `require()`, 3 use ESM:

```
commonjs-to-esm
└── 60.0% · done 3 / 5
```
