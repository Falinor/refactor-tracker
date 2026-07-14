import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { dirname, join, resolve } from 'node:path';

// The cache file holds the per-task done/total baseline that drives deltas and
// --fail-on-regression; the state file holds the registered/completed timestamps.
// Both are restored before the run and saved after so CI runs are not cold-start.
const PERSISTED_FILES = ['.refactor-tracker-cache.json', '.refactor-tracker-state.json'];

// The core CLI resolves the cache/state directory from the config file's own
// location (relative to the process cwd), not from the working directory alone —
// mirror that here so a nested config-path maps to the same files on disk.
function baseDir(workingDirectory: string, configPath: string): string {
  return dirname(resolve(workingDirectory, configPath));
}

export function cacheKey(workingDirectory: string, configPath: string): string {
  return `refactor-tracker-${process.platform}-${baseDir(workingDirectory, configPath)}-main`;
}

export function cachePaths(workingDirectory: string, configPath: string): string[] {
  return PERSISTED_FILES.map((f) => join(baseDir(workingDirectory, configPath), f));
}

export async function restoreCache(workingDirectory: string, configPath: string): Promise<void> {
  const key = cacheKey(workingDirectory, configPath);
  const restoreKeys = [
    `refactor-tracker-${process.platform}-${baseDir(workingDirectory, configPath)}-`,
  ];
  try {
    const hit = await cache.restoreCache(
      cachePaths(workingDirectory, configPath),
      key,
      restoreKeys,
    );
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

export async function saveCache(workingDirectory: string, configPath: string): Promise<void> {
  if (!isDefaultBranchPush()) {
    core.info('Not a push to the default branch — skipping cache save.');
    return;
  }
  const key = cacheKey(workingDirectory, configPath);
  try {
    await cache.saveCache(cachePaths(workingDirectory, configPath), key);
    core.info(`Saved refactor-tracker cache under key: ${key}`);
  } catch (err) {
    if (err instanceof cache.ReserveCacheError) {
      core.info('A cache for this key already exists — nothing to save.');
      return;
    }
    core.warning(`Could not save cache: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function isDefaultBranchPush(): boolean {
  const { eventName, ref, payload } = github.context;
  if (eventName !== 'push') return false;
  const repository = payload.repository as { default_branch?: string } | undefined;
  const defaultBranch = repository?.default_branch ?? 'main';
  return ref === `refs/heads/${defaultBranch}`;
}
