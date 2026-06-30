import { buildProgram } from '../src/program.js';

export const TEST_VERSION = '9.9.9';

// Drives a fresh program and unifies commander's two exit channels:
// a thrown CommanderError (own errors/help/version) and an action-set process.exitCode.
export async function runCli(args: string[]): Promise<number> {
  const program = buildProgram(TEST_VERSION)
    .exitOverride()
    .configureOutput({ writeOut: () => {}, writeErr: () => {} });
  try {
    await program.parseAsync(args, { from: 'user' });
    return typeof process.exitCode === 'number' ? process.exitCode : 0;
  } catch (err) {
    return (err as { exitCode?: number }).exitCode ?? 1;
  } finally {
    process.exitCode = 0;
  }
}
