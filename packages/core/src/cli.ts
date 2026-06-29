#!/usr/bin/env node
import { createRequire } from 'node:module';
import { runMain } from 'citty';
import { main } from './main.js';
import { createInitCommand } from './commands/init.js';

const pkg = createRequire(import.meta.url)('../package.json') as { version: string };

// citty 0.2.2 runs a parent command's `run` even after a subcommand dispatches,
// so `init` is dispatched here as a top-level command rather than a subCommand.
const argv = process.argv.slice(2);
if (argv[0] === 'init') {
  runMain(createInitCommand(pkg.version), { rawArgs: argv.slice(1) });
} else {
  runMain(main);
}
