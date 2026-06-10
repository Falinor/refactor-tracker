import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { defineCommand } from 'citty';
import { loadConfig, type ReporterConfig } from './config.js';
import { runEngine } from './engine.js';
import { createReporters } from './reporters/index.js';
import { applyView } from './view.js';

const pkg = createRequire(import.meta.url)('../package.json') as { version: string };

export interface ExecuteOptions {
  config: string;
  dryRun: boolean;
  failOnRegression: boolean;
  tags?: string[];
  ids?: string[];
  reporters?: ReporterConfig[];
  showCompleted?: boolean;
  sortBy?: 'registered' | 'completed' | 'progress';
  reportOutput?: string;
  noCache?: boolean;
  cachePath?: string;
}

const FILE_REPORTERS = new Set(['json', 'markdown', 'html']);

export function parseReporterFlag(raw: string): ReporterConfig {
  const colon = raw.indexOf(':');
  const type = colon === -1 ? raw : raw.slice(0, colon);
  const output = colon === -1 ? undefined : raw.slice(colon + 1);
  if (type === 'stdout') {
    if (output !== undefined) {
      throw new Error('--reporter stdout takes no output path');
    }
    return { type: 'stdout' };
  }
  if (FILE_REPORTERS.has(type)) {
    if (!output) {
      throw new Error(`--reporter ${type} requires an output path (--reporter ${type}:<path>)`);
    }
    return { type, output };
  }
  throw new Error(`Unknown --reporter type: ${type}. Expected: stdout | json | markdown | html.`);
}

export async function execute(options: ExecuteOptions): Promise<number> {
  const configPath = path.resolve(options.config);
  const baseDir = path.dirname(configPath);
  const config = await loadConfig(configPath);

  const cachePath = options.cachePath
    ? path.resolve(options.cachePath)
    : path.join(baseDir, '.refactor-tracker-cache.json');

  let report;
  try {
    report = await runEngine(config, {
      cachePath,
      statePath: path.join(baseDir, '.refactor-tracker-state.json'),
      cwd: baseDir,
      dryRun: options.dryRun,
      tagFilter: options.tags,
      idFilter: options.ids,
      noCache: options.noCache,
    });
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  if (options.reportOutput) {
    await writeFile(path.resolve(options.reportOutput), JSON.stringify(report, null, 2), 'utf8');
  }

  if (options.dryRun) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const reporterConfigs = options.reporters ?? config.reporters ?? [{ type: 'stdout' }];
    const reporters = await createReporters(reporterConfigs, baseDir);
    const filtered = applyView(report, {
      showCompleted: !!options.showCompleted,
      sortBy: options.sortBy,
    });
    for (const reporter of reporters) {
      await reporter.report(reporter.wantsRaw ? report : filtered);
    }
  }

  if (options.failOnRegression && report.tasks.some((t) => t.delta !== null && t.delta < 0)) {
    console.error("Regression detected: a tracked task's done count decreased.");
    return 1;
  }
  return 0;
}

function collectRepeatedFlag(rawArgs: string[], flag: string): string[] {
  const values: string[] = [];
  const prefix = `${flag}=`;
  for (let i = 0; i < rawArgs.length; i++) {
    const a = rawArgs[i];
    if (a === flag) {
      const next = rawArgs[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        values.push(next);
        i++;
      }
    } else if (a.startsWith(prefix)) {
      values.push(a.slice(prefix.length));
    }
  }
  return values;
}

export const main = defineCommand({
  meta: {
    name: 'refactor-tracker',
    version: pkg.version,
    description:
      'Run configurable shell detections to track and report technical-refactor progress.',
  },
  args: {
    config: {
      type: 'string',
      description: 'Path to the config file',
      default: '.refactor-tracker.yml',
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
    id: {
      type: 'string',
      description:
        'Filter refactors by id (repeatable, OR semantics: --id a --id b). Combines with --tag via AND.',
      valueHint: 'id',
    },
    reporter: {
      type: 'string',
      description:
        'Override configured reporters (repeatable): stdout, or json:<path> / markdown:<path> / html:<path>',
      valueHint: 'type[:path]',
    },
    'show-completed': {
      type: 'boolean',
      description: 'Include refactors that have already reached 100% in reporter output',
      default: false,
    },
    'sort-by': {
      type: 'string',
      description:
        'Sort tasks: registered (oldest first), completed (most recent first), or progress (least done first)',
      valueHint: 'registered|completed|progress',
    },
    'report-output': {
      type: 'string',
      description:
        'Write the full Report as JSON to this path (independent of configured reporters)',
      valueHint: 'path',
    },
    'no-cache': {
      type: 'boolean',
      description: 'Skip reading and writing the cache file; delta will be null for every task',
      default: false,
    },
    'cache-path': {
      type: 'string',
      description:
        'Override the cache file path (default: .refactor-tracker-cache.json next to the config)',
      valueHint: 'path',
    },
  },
  async run({ args, rawArgs }) {
    const tags = collectRepeatedFlag(rawArgs, '--tag');
    const ids = collectRepeatedFlag(rawArgs, '--id');
    const reporterFlags = collectRepeatedFlag(rawArgs, '--reporter');
    let reporters: ReporterConfig[] | undefined;
    if (reporterFlags.length > 0) {
      try {
        reporters = reporterFlags.map(parseReporterFlag);
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
        return 1;
      }
    }
    const sortBy = args['sort-by'] as string | undefined;
    if (sortBy !== undefined && !['registered', 'completed', 'progress'].includes(sortBy)) {
      console.error(
        `Invalid --sort-by value: ${sortBy}. Expected: registered | completed | progress.`,
      );
      process.exitCode = 1;
      return 1;
    }
    const code = await execute({
      config: args.config,
      dryRun: args['dry-run'],
      failOnRegression: args['fail-on-regression'],
      tags: tags.length > 0 ? tags : undefined,
      ids: ids.length > 0 ? ids : undefined,
      reporters,
      showCompleted: args['show-completed'],
      sortBy: sortBy as ExecuteOptions['sortBy'] | undefined,
      reportOutput: args['report-output'] as string | undefined,
      noCache: args['no-cache'],
      cachePath: args['cache-path'] as string | undefined,
    });
    if (code !== 0) process.exitCode = code;
    return code;
  },
});
