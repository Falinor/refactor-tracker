#!/usr/bin/env node
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { defineCommand, runMain } from 'citty';
import { loadConfig } from './config.js';
import { runEngine } from './engine.js';
import { createReporters } from './reporters/index.js';
import { applyView } from './view.js';

export interface ExecuteOptions {
  config: string;
  dryRun: boolean;
  failOnRegression: boolean;
  tags?: string[];
  showCompleted?: boolean;
  sortBy?: 'registered' | 'completed' | 'progress';
}

export async function execute(options: ExecuteOptions): Promise<number> {
  const configPath = path.resolve(options.config);
  const baseDir = path.dirname(configPath);
  const config = await loadConfig(configPath);

  let report;
  try {
    report = await runEngine(config, {
      cachePath: path.join(baseDir, '.refactor-tracker-cache.json'),
      statePath: path.join(baseDir, '.refactor-tracker-state.json'),
      cwd: baseDir,
      dryRun: options.dryRun,
      tagFilter: options.tags,
    });
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  if (options.dryRun) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const reporterConfigs = config.reporters ?? [{ type: 'stdout' }];
    const reporters = await createReporters(reporterConfigs, baseDir);
    const filtered = applyView(report, {
      showCompleted: !!options.showCompleted,
      sortBy: options.sortBy,
    });
    for (let i = 0; i < reporters.length; i++) {
      const isJson = reporterConfigs[i].type === 'json';
      await reporters[i].report(isJson ? report : filtered);
    }
  }

  if (options.failOnRegression && report.tasks.some((t) => t.delta !== null && t.delta < 0)) {
    console.error("Regression detected: a tracked task's done count decreased.");
    return 1;
  }
  return 0;
}

function collectTagFlags(rawArgs: string[]): string[] {
  const tags: string[] = [];
  for (let i = 0; i < rawArgs.length; i++) {
    const a = rawArgs[i];
    if (a === '--tag') {
      const next = rawArgs[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        tags.push(next);
        i++;
      }
    } else if (a.startsWith('--tag=')) {
      tags.push(a.slice('--tag='.length));
    }
  }
  return tags;
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
    tag: {
      type: 'string',
      description: 'Filter refactors by tag (repeatable, OR semantics: --tag a --tag b)',
      valueHint: 'name',
    },
    'show-completed': {
      type: 'boolean',
      description: 'Include refactors that have already reached 100% in reporter output',
      default: false,
    },
  },
  async run({ args, rawArgs }) {
    const tags = collectTagFlags(rawArgs);
    const code = await execute({
      config: args.config,
      dryRun: args['dry-run'],
      failOnRegression: args['fail-on-regression'],
      tags: tags.length > 0 ? tags : undefined,
      showCompleted: args['show-completed'],
    });
    if (code !== 0) process.exitCode = code;
    return code;
  },
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMain(main);
}
