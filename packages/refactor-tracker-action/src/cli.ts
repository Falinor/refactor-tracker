import { spawn } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Report } from 'refactor-tracker';
import type { Inputs } from './inputs.js';

export async function runRefactorTracker(inputs: Inputs): Promise<Report> {
  const tmp = await mkdtemp(join(tmpdir(), 'refactor-tracker-action-'));
  const reportPath = join(tmp, 'report.json');

  await execChild(
    'npx',
    ['--yes', 'refactor-tracker', '--config', inputs.configPath, '--report-output', reportPath],
    inputs.workingDirectory,
  );

  const raw = await readFile(reportPath, 'utf8');
  return JSON.parse(raw) as Report;
}

function execChild(cmd: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`refactor-tracker exited with code ${code ?? 'null'}`));
    });
    child.on('error', reject);
  });
}
