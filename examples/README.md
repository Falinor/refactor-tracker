# Examples

Each subdirectory is a self-contained, runnable example: a tiny TypeScript source tree plus a `.refactor-tracker.yml` that tracks a real migration shape. Drop into any of them and run the CLI to see the numbers.

```bash
cd examples/ts-strict-migration
pnpm dlx refactor-tracker
```

| Example                                        | What it tracks                                           |
| ---------------------------------------------- | -------------------------------------------------------- |
| [`ts-strict-migration`](./ts-strict-migration) | Files using `any` types vs total `.ts` files             |
| [`class-to-hooks`](./class-to-hooks)           | React class components remaining vs total components     |
| [`moment-to-date-fns`](./moment-to-date-fns)   | Files importing `moment` vs files using `date-fns`       |
| [`redux-to-zustand`](./redux-to-zustand)       | Files importing `react-redux` vs files using `zustand`   |
| [`commonjs-to-esm`](./commonjs-to-esm)         | Files using `require()` vs files using `import`/`export` |
| [`mocha-to-vitest`](./mocha-to-vitest)         | `*.spec.js` (Mocha) test files vs `*.test.ts` (Vitest)   |

All examples are TypeScript-flavoured for now — the detection commands are plain shell, so the patterns transfer to any language that has greppable file structure.

## What each example contains

```
examples/<name>/
  README.md            # what's being tracked, the detector commands, expected output
  .refactor-tracker.yml  # the actual config
  src/ (or tests/)     # tiny source tree with realistic patterns
```

The source files are intentionally minimal — just enough that the detector commands return non-trivial counts. They are not meant to be real working apps.

## Caveats

- The detector commands assume a POSIX shell (`grep`, `find`, `wc`, `tr`). Tested on macOS and Linux. Windows users should run them under WSL or Git Bash.
- The examples are **not** part of the pnpm workspace — they have no `package.json` and no dependencies. Running the CLI from inside an example folder works because `refactor-tracker` only needs the YAML and the shell.
