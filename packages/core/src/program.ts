import { Command } from '@commander-js/extra-typings';
import { configureRun } from './main.js';
import { configureInitCommand } from './commands/init.js';

export function buildProgram(version: string): Command {
  const program = new Command()
    .name('refactor-tracker')
    .description(
      'Run configurable shell detections to track and report technical-refactor progress.',
    )
    // `-v, --version` (not commander's default `-V`) to match the pre-migration citty behavior.
    .version(version, '-v, --version');

  // Root and the run/init subcommands share option names (e.g. -c/--config); without this the
  // root would swallow options meant for a subcommand. Parent options must precede the subcommand.
  program.enablePositionalOptions();

  configureRun(program); // bare `refactor-tracker [flags]` = detection (default action)
  // Subcommands don't inherit the root's --version, so give each its own.
  configureRun(program.command('run')).version(version, '-v, --version');
  configureInitCommand(program.command('init'), version);

  return program;
}
