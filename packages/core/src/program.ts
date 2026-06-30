import { Command } from '@commander-js/extra-typings';
import { configureRun } from './main.js';
import { configureInitCommand } from './commands/init.js';

export function buildProgram(version: string): Command {
  const program = new Command()
    .name('refactor-tracker')
    .description(
      'Run configurable shell detections to track and report technical-refactor progress.',
    )
    .version(version);

  // Root and the run/init subcommands share option names (e.g. -c/--config); without this the
  // root would swallow options meant for a subcommand. Parent options must precede the subcommand.
  program.enablePositionalOptions();

  configureRun(program); // bare `refactor-tracker [flags]` = detection (default action)
  configureRun(program.command('run')); // explicit `run` alias (same options + action)
  configureInitCommand(program.command('init'), version);

  return program;
}
