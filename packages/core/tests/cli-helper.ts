import { buildProgram } from '../src/program.js';

export const TEST_VERSION = '9.9.9';

// exitOverride()/configureOutput() do NOT propagate to subcommands that buildProgram
// created before we call them, so a commander-level exit on `run`/`init` (errors,
// --version, --help) would call process.exit() and kill the test runner. Apply both
// to the root AND every subcommand so all exit channels are captured here.
function freshProgram(out?: string[]) {
  const program = buildProgram(TEST_VERSION);
  const writeOut = out ? (s: string) => void out.push(s) : () => {};
  for (const cmd of [program, ...program.commands]) {
    cmd.exitOverride().configureOutput({ writeOut, writeErr: () => {} });
  }
  return program;
}

// Drives a fresh program and unifies commander's two exit channels:
// a thrown CommanderError (own errors/help/version) and an action-set process.exitCode.
export async function runCli(args: string[]): Promise<number> {
  const program = freshProgram();
  try {
    await program.parseAsync(args, { from: 'user' });
    return typeof process.exitCode === 'number' ? process.exitCode : 0;
  } catch (err) {
    return (err as { exitCode?: number }).exitCode ?? 1;
  } finally {
    process.exitCode = 0;
  }
}

// Like runCli, but also returns whatever the command wrote to stdout (e.g. --version output).
export async function captureCli(args: string[]): Promise<{ code: number; out: string }> {
  const out: string[] = [];
  const program = freshProgram(out);
  try {
    await program.parseAsync(args, { from: 'user' });
    return { code: typeof process.exitCode === 'number' ? process.exitCode : 0, out: out.join('') };
  } catch (err) {
    return { code: (err as { exitCode?: number }).exitCode ?? 1, out: out.join('') };
  } finally {
    process.exitCode = 0;
  }
}
