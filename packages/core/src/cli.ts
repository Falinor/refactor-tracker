#!/usr/bin/env node
import { createRequire } from 'node:module';
import { buildProgram } from './program.js';

const pkg = createRequire(import.meta.url)('../package.json') as { version: string };

await buildProgram(pkg.version).parseAsync();
