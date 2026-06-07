import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { join } from 'node:path';

const CACHE_FILE = '.refactor-tracker-cache.json';

export function cacheKey(workingDirectory: string): string {
  return `refactor-tracker-${process.platform}-${workingDirectory}-main`;
}

export function cachePaths(workingDirectory: string): string[] {
  return [join(workingDirectory, CACHE_FILE)];
}

export async function restoreCache(workingDirectory: string): Promise<void> {
  const key = cacheKey(workingDirectory);
  const restoreKeys = [`refactor-tracker-${process.platform}-${workingDirectory}-`];
  try {
    const hit = await cache.restoreCache(cachePaths(workingDirectory), key, restoreKeys);
    if (hit) {
      core.info(`Restored refactor-tracker cache from key: ${hit}`);
    } else {
      core.info('No prior cache found — this run will produce the initial baseline.');
    }
  } catch (err) {
    core.warning(
      `Could not restore cache: ${err instanceof Error ? err.message : String(err)}. Proceeding without a baseline.`,
    );
  }
}

export async function saveCache(workingDirectory: string): Promise<void> {
  if (!isDefaultBranchPush()) {
    core.info('Not a push to the default branch — skipping cache save.');
    return;
  }
  const key = cacheKey(workingDirectory);
  try {
    await cache.saveCache(cachePaths(workingDirectory), key);
    core.info(`Saved refactor-tracker cache under key: ${key}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('already exists')) {
      core.info('A cache for this key already exists — nothing to save.');
      return;
    }
    core.warning(`Could not save cache: ${msg}`);
  }
}

function isDefaultBranchPush(): boolean {
  const { eventName, ref, payload } = github.context;
  if (eventName !== 'push') return false;
  const repository = payload.repository as { default_branch?: string } | undefined;
  const defaultBranch = repository?.default_branch ?? 'main';
  return ref === `refs/heads/${defaultBranch}`;
}
