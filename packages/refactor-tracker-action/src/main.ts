import * as core from '@actions/core';
import { restoreCache, saveCache } from './cache.js';
import { runRefactorTracker } from './cli.js';
import { formatComment, postComment } from './comment.js';
import { readInputs } from './inputs.js';
import { hasRegression, setOutputs } from './outputs.js';

async function run(): Promise<void> {
  try {
    const inputs = readInputs();

    if (inputs.cacheStrategy === 'actions-cache') {
      await restoreCache(inputs.workingDirectory);
    }

    const report = await runRefactorTracker(inputs);

    setOutputs(report);

    if (inputs.commentOnPr) {
      await postComment(formatComment(report), inputs.githubToken);
    }

    if (inputs.cacheStrategy === 'actions-cache') {
      await saveCache(inputs.workingDirectory);
    }

    if (inputs.failOnRegression && hasRegression(report)) {
      core.setFailed("A tracked refactor's done count decreased vs the baseline.");
    }
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : String(err));
  }
}

void run();
