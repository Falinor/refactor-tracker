import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Reporter } from '../types.js';
import type { ReporterConfig } from '../config.js';
import { StdoutReporter } from './stdout.js';
import { JsonReporter } from './json.js';
import { MarkdownReporter } from './markdown.js';
import { HtmlReporter } from './html.js';

export async function createReporters(
  configs: ReporterConfig[] | undefined,
  baseDir: string,
): Promise<Reporter[]> {
  if (!configs || configs.length === 0) return [new StdoutReporter()];

  const resolveOutput = (output: string): string => path.resolve(baseDir, output);
  const reporters: Reporter[] = [];
  for (const config of configs) {
    switch (config.type) {
      case 'stdout':
        reporters.push(new StdoutReporter());
        break;
      case 'json':
        reporters.push(new JsonReporter(resolveOutput(config.output as string)));
        break;
      case 'markdown':
        reporters.push(new MarkdownReporter(resolveOutput(config.output as string)));
        break;
      case 'html':
        reporters.push(new HtmlReporter(resolveOutput(config.output as string)));
        break;
      case 'custom': {
        const resolved = path.resolve(baseDir, config.path as string);
        const mod = await import(pathToFileURL(resolved).href);
        reporters.push(mod.default as Reporter);
        break;
      }
      default:
        throw new Error(`Unknown reporter type: ${config.type}`);
    }
  }
  return reporters;
}
