import { execa } from 'execa';

export interface CommandResult {
  stdout: string;
  exitCode: number;
}

export async function runCommand(command: string, cwd?: string): Promise<CommandResult> {
  const result = await execa(command, { shell: true, reject: false, cwd });
  return {
    stdout: String(result.stdout ?? '').trim(),
    exitCode: result.exitCode ?? 0,
  };
}
