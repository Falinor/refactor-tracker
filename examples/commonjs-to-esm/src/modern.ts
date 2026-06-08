import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function readConfig(name: string, dir: string): Promise<string> {
  return readFile(join(dir, name), 'utf8');
}
