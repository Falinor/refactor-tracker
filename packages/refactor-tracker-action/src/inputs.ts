import * as core from '@actions/core';

export type CacheStrategy = 'actions-cache' | 'none';

export interface Inputs {
  configPath: string;
  workingDirectory: string;
  failOnRegression: boolean;
  commentOnPr: boolean;
  cacheStrategy: CacheStrategy;
  githubToken: string;
}

export function readInputs(): Inputs {
  const cacheStrategy = (core.getInput('cache-strategy') || 'actions-cache') as CacheStrategy;
  if (cacheStrategy !== 'actions-cache' && cacheStrategy !== 'none') {
    throw new Error(
      `Invalid cache-strategy: "${cacheStrategy}". Expected one of: actions-cache | none.`,
    );
  }
  return {
    configPath: core.getInput('config-path') || '.refactor-tracker.yml',
    workingDirectory: core.getInput('working-directory') || '.',
    failOnRegression: core.getBooleanInput('fail-on-regression'),
    commentOnPr: core.getBooleanInput('comment-on-pr'),
    cacheStrategy,
    githubToken: core.getInput('github-token', { required: true }),
  };
}
