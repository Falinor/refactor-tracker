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
        const hasModule = typeof config.module === 'string' && config.module.length > 0;
        const hasPath = typeof config.path === 'string' && config.path.length > 0;
        if (hasModule === hasPath) {
          throw new Error('custom reporter: exactly one of `module` or `path` must be provided');
        }
        const specifier = hasModule
          ? (config.module as string)
          : pathToFileURL(path.resolve(baseDir, config.path as string)).href;
        const mod = await import(specifier);
        const {
          type: _t,
          module: _m,
          path: _p,
          ...reporterConfig
        } = config as Record<string, unknown>;
        const exported = mod.default as Reporter | ((cfg: Record<string, unknown>) => Reporter);
        const reporter = typeof exported === 'function' ? exported(reporterConfig) : exported;
        reporters.push(reporter);
        break;
      }
      default:
        throw new Error(`Unknown reporter type: ${config.type}`);
    }
  }
  return reporters;
}
