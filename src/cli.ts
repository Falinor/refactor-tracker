#!/usr/bin/env node
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { defineCommand, runMain } from 'citty';
import { loadConfig } from './config.js';
import { runEngine } from './engine.js';
import { createReporters } from './reporters/index.js';

export interface ExecuteOptions {
  config: string;
  dryRun: boolean;
  failOnRegression: boolean;
}

export async function execute(options: ExecuteOptions): Promise<number> {
  const configPath = path.resolve(options.config);
  const baseDir = path.dirname(configPath);
  const config = await loadConfig(configPath);

  const report = await runEngine(config, {
    cachePath: path.join(baseDir, '.refactor-tracker-cache.json'),
    cwd: baseDir,
    dryRun: options.dryRun,
  });

  if (options.dryRun) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const reporters = await createReporters(config.reporters, baseDir);
    for (const reporter of reporters) await reporter.report(report);
  }

  if (options.failOnRegression && report.tasks.some((t) => t.delta !== null && t.delta < 0)) {
    console.error("Regression detected: a tracked task's done count decreased.");
    return 1;
  }
  return 0;
}

export const main = defineCommand({
  meta: {
    name: 'refactor-tracker',
    description:
      'Run configurable shell detections to track and report technical-refactor progress.',
  },
  args: {
    config: {
      type: 'string',
      description: 'Path to the config file',
      default: '.tech-refactors.yml',
      alias: ['c'],
    },
    'dry-run': {
      type: 'boolean',
      description: 'Run detections and print the report; do not invoke reporters',
      default: false,
    },
    'fail-on-regression': {
      type: 'boolean',
      description: "Exit 1 if any task's done count decreased vs the cache",
      default: false,
    },
  },
  async run({ args }) {
    const code = await execute({
      config: args.config,
      dryRun: args['dry-run'],
      failOnRegression: args['fail-on-regression'],
    });
    if (code !== 0) process.exitCode = code;
    return code;
  },
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMain(main);
}
