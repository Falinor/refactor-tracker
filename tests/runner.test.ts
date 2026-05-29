import { describe, it, expect } from 'vitest';
import { runCommand } from '../src/runner.js';

describe('runCommand', () => {
  it('returns trimmed stdout of a shell command', async () => {
    const result = await runCommand('echo 42');
    expect(result.stdout).toBe('42');
    expect(result.exitCode).toBe(0);
  });

  it('runs commands with pipes', async () => {
    const result = await runCommand('printf "a\\nb\\nc\\n" | wc -l | tr -d " "');
    expect(result.stdout).toBe('3');
  });

  it('captures a non-zero exit code without throwing', async () => {
    const result = await runCommand('exit 3');
    expect(result.exitCode).toBe(3);
  });

  it('respects the cwd option', async () => {
    const result = await runCommand('pwd', '/tmp');
    expect(result.stdout).toContain('/tmp');
  });
});
