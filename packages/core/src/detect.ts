import type { DetectConfig } from './config.js';
import type { CommandResult } from './runner.js';

export type CommandRunner = (command: string, cwd?: string) => Promise<CommandResult>;

export interface Counts {
  done: number;
  total: number;
}

function parseCount(stdout: string, command: string): number {
  const n = Number(stdout);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(
      `Command did not print a non-negative integer: "${command}" produced "${stdout}"`,
    );
  }
  return n;
}

export async function resolveDetection(
  detect: DetectConfig,
  run: CommandRunner,
  cwd?: string,
): Promise<Counts> {
  if ('binary' in detect && detect.binary) {
    const { exitCode } = await run(detect.command, cwd);
    return { done: exitCode === 0 ? 1 : 0, total: 1 };
  }

  const counts: Partial<Record<'done' | 'remaining' | 'total', number>> = {};
  for (const key of ['done', 'remaining', 'total'] as const) {
    const field = (detect as Record<string, { command: string } | undefined>)[key];
    if (field) {
      const { stdout } = await run(field.command, cwd);
      counts[key] = parseCount(stdout, field.command);
    }
  }

  const { done, remaining, total } = counts;
  if (done !== undefined && total !== undefined) {
    return { done, total };
  }
  if (done !== undefined && remaining !== undefined) {
    return { done, total: done + remaining };
  }
  if (remaining !== undefined && total !== undefined) {
    return { done: total - remaining, total };
  }
  throw new Error('detect must provide binary, or any two of done/remaining/total');
}

export async function resolveList(
  detect: DetectConfig,
  run: CommandRunner,
  cwd?: string,
): Promise<string[] | undefined> {
  if ('binary' in detect) return undefined;
  if (!detect.list) return undefined;
  const { stdout } = await run(detect.list.command, cwd);
  const items = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return items.length > 0 ? items : undefined;
}
