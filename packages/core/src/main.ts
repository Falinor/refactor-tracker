import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Command, Option } from '@commander-js/extra-typings';
import { loadConfig, type ReporterConfig } from './config.js';
import { runEngine } from './engine.js';
import { createReporters } from './reporters/index.js';
import { applyView } from './view.js';

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

const collect = (value: string, previous: string[]): string[] => previous.concat(value);

export function configureRun(cmd: Command): Command {
  return cmd
    .description(
      'Run configurable shell detections to track and report technical-refactor progress.',
    )
    .option('-c, --config <path>', 'Path to the config file', '.refactor-tracker.yml')
    .option('--dry-run', 'Run detections and print the report; do not invoke reporters', false)
    .option('--fail-on-regression', "Exit 1 if any task's done count decreased vs the cache", false)
    .option('--tag <name>', 'Filter refactors by tag (repeatable, OR semantics)', collect, [])
    .option(
      '--id <id>',
      'Filter refactors by id (repeatable, OR; combines with --tag via AND)',
      collect,
      [],
    )
    .option(
      '--reporter <type[:path]>',
      'Override configured reporters (repeatable): stdout, json:<path>, markdown:<path>, html:<path>',
      collect,
      [],
    )
    .option('--show-completed', 'Include refactors already at 100% in reporter output', false)
    .addOption(
      new Option('--sort-by <key>', 'Sort tasks').choices(['registered', 'completed', 'progress']),
    )
    .option('--report-output <path>', 'Write the full Report as JSON to this path')
    .option(
      '--no-cache',
      'Skip reading and writing the cache file; delta will be null for every task',
    )
    .option('--cache-path <path>', 'Override the cache file path')
    .action(async (opts) => {
      let reporters: ReporterConfig[] | undefined;
      if (opts.reporter.length > 0) {
        try {
          reporters = opts.reporter.map(parseReporterFlag);
        } catch (err) {
          console.error(err instanceof Error ? err.message : String(err));
          process.exitCode = 1;
          return;
        }
      }
      const code = await execute({
        config: opts.config,
        dryRun: opts.dryRun,
        failOnRegression: opts.failOnRegression,
        tags: opts.tag.length > 0 ? opts.tag : undefined,
        ids: opts.id.length > 0 ? opts.id : undefined,
        reporters,
        showCompleted: opts.showCompleted,
        sortBy: opts.sortBy,
        reportOutput: opts.reportOutput,
        noCache: !opts.cache,
        cachePath: opts.cachePath,
      });
      if (code !== 0) process.exitCode = code;
    });
}
