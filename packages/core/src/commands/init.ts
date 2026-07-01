import { writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { Command } from '@commander-js/extra-typings';
import { intro, outro, cancel, text, multiselect, select, confirm, isCancel } from '@clack/prompts';
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

function requireValue<T>(value: T | symbol): T {
  if (isCancel(value)) throw new InitCancelled();
  return value as T;
}

export const clackPrompter: InitPrompter = {
  async configPath(defaultPath) {
    return requireValue(
      await text({
        message: 'Config file path',
        placeholder: defaultPath,
        defaultValue: defaultPath,
      }),
    );
  },
  async examples() {
    return requireValue(
      await multiselect({
        message: 'Which example detectors should I include?',
        options: [
          { value: 'counts', label: 'counts (done/total)' },
          { value: 'remaining', label: 'remaining (+ total)' },
          { value: 'binary', label: 'binary (exit code)' },
        ],
        initialValues: ['counts', 'remaining', 'binary'],
        required: true,
      }),
    ) as ExampleKind[];
  },
  async reporter() {
    return requireValue(
      await select({
        message: 'Default reporter?',
        options: [
          { value: 'stdout', label: 'stdout (terminal)' },
          { value: 'json', label: 'json file' },
          { value: 'markdown', label: 'markdown file' },
          { value: 'html', label: 'html file' },
          { value: 'none', label: 'none (configure later)' },
        ],
        initialValue: 'stdout',
      }),
    ) as ReporterKind;
  },
  async confirmOverwrite(targetPath) {
    return requireValue(await confirm({ message: `${targetPath} exists. Overwrite?` }));
  },
};

export function configureInitCommand(cmd: Command, version: string): Command {
  return cmd
    .description('Scaffold a .refactor-tracker.yml config file')
    .version(version, '-v, --version')
    .option('-c, --config <path>', 'Path for the generated config')
    .option('--reporter <type>', 'Default reporter: stdout | json | markdown | html | none')
    .option('-y, --yes', 'Skip prompts; write defaults', false)
    .option('--force', 'Overwrite an existing config file', false)
    .action(async (opts) => {
      const schemaUrl = `https://cdn.jsdelivr.net/npm/refactor-tracker@${version}/schema.json`;
      const isTTY = !!process.stdout.isTTY;
      const interactive = isTTY && !opts.yes;
      if (interactive) intro('refactor-tracker init');
      try {
        const options = await gatherOptions(opts as InitArgs, { prompter: clackPrompter, isTTY });
        const result = await runInit(options, {
          cwd: process.cwd(),
          schemaUrl,
          interactive,
          prompter: clackPrompter,
        });
        if (!result.wrote) {
          if (interactive) cancel('Cancelled — no file written.');
          return;
        }
        const msg = `Wrote ${options.configPath}. Run \`refactor-tracker\` to see your first report.`;
        if (interactive) outro(msg);
        else console.log(msg);
      } catch (err) {
        if (err instanceof InitCancelled) {
          cancel('Cancelled — no file written.');
          process.exitCode = 130;
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        if (interactive) cancel(message);
        else console.error(message);
        process.exitCode = 1;
      }
    });
}
