import { writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { renderConfig, type ExampleKind, type ReporterKind } from './init-template.js';

export const DEFAULT_CONFIG_PATH = '.refactor-tracker.yml';
const ALL_EXAMPLES: ExampleKind[] = ['counts', 'remaining', 'binary'];
const REPORTER_KINDS: ReporterKind[] = ['stdout', 'json', 'markdown', 'html', 'none'];

export interface InitOptions {
  configPath: string;
  examples: ExampleKind[];
  reporter: ReporterKind;
  force: boolean;
}

export interface InitArgs {
  config?: string;
  reporter?: string;
  yes?: boolean;
  force?: boolean;
}

export interface InitPrompter {
  configPath(defaultPath: string): Promise<string>;
  examples(): Promise<ExampleKind[]>;
  reporter(): Promise<ReporterKind>;
  confirmOverwrite(targetPath: string): Promise<boolean>;
}

export class InitCancelled extends Error {}

function parseReporterKind(value: string): ReporterKind {
  if (!REPORTER_KINDS.includes(value as ReporterKind)) {
    throw new Error(`Invalid --reporter value: ${value}. Expected: ${REPORTER_KINDS.join(' | ')}.`);
  }
  return value as ReporterKind;
}

export async function gatherOptions(
  args: InitArgs,
  ctx: { prompter: InitPrompter; isTTY: boolean },
): Promise<InitOptions> {
  const interactive = ctx.isTTY && !args.yes;
  const force = !!args.force;

  if (!interactive) {
    return {
      configPath: args.config ?? DEFAULT_CONFIG_PATH,
      examples: ALL_EXAMPLES,
      reporter: args.reporter ? parseReporterKind(args.reporter) : 'stdout',
      force,
    };
  }

  const configPath = args.config ?? (await ctx.prompter.configPath(DEFAULT_CONFIG_PATH));
  const examples = await ctx.prompter.examples();
  const reporter = args.reporter ? parseReporterKind(args.reporter) : await ctx.prompter.reporter();
  return { configPath, examples, reporter, force };
}

export interface RunInitContext {
  cwd: string;
  schemaUrl: string;
  interactive: boolean;
  prompter: InitPrompter;
}

export interface RunInitResult {
  wrote: boolean;
  targetPath: string;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function runInit(options: InitOptions, ctx: RunInitContext): Promise<RunInitResult> {
  const targetPath = path.resolve(ctx.cwd, options.configPath);

  if ((await fileExists(targetPath)) && !options.force) {
    if (!ctx.interactive) {
      throw new Error(`${options.configPath} already exists. Use --force to overwrite.`);
    }
    const ok = await ctx.prompter.confirmOverwrite(options.configPath);
    if (!ok) return { wrote: false, targetPath };
  }

  const content = renderConfig({
    schemaUrl: ctx.schemaUrl,
    examples: options.examples,
    reporter: options.reporter,
  });
  await writeFile(targetPath, content, 'utf8');
  return { wrote: true, targetPath };
}
