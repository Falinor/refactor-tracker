import * as core from '@actions/core';
import * as github from '@actions/github';
import type { Report, TaskResult } from 'refactor-tracker';
import { totalDelta as sumDelta } from './report.js';

export const STICKY_MARKER = '<!-- refactor-tracker:sticky -->';

export function formatComment(report: Report): string {
  const moved = report.tasks.filter((t) => t.delta !== null && t.delta !== 0);
  const delta = sumDelta(report);
  const deltaSign = delta > 0 ? '+' : '';

  const summary =
    moved.length > 0
      ? `**refactor-tracker** — ${moved.length} of ${report.tasks.length} tracked refactors moved (${deltaSign}${delta} total)`
      : `**refactor-tracker** — no movement across ${report.tasks.length} tracked refactors`;

  return [
    STICKY_MARKER,
    summary,
    '',
    '<details>',
    '<summary>Per-task details</summary>',
    '',
    formatTable(report.tasks),
    '',
    '</details>',
  ].join('\n');
}

function formatTable(tasks: TaskResult[]): string {
  const rows = tasks.map((t) => {
    const delta = t.delta === null ? '—' : t.delta > 0 ? `+${t.delta}` : `${t.delta}`;
    return `| ${t.name} | ${t.done} / ${t.total} | ${t.percentage}% | ${delta} |`;
  });
  return ['| Refactor | Done / Total | % | Δ |', '| --- | --- | --- | --- |', ...rows].join('\n');
}

export async function postComment(body: string, token: string): Promise<void> {
  const ctx = github.context;
  if (ctx.eventName !== 'pull_request' && ctx.eventName !== 'pull_request_target') {
    core.info('Not a pull_request event — skipping comment.');
    return;
  }
  const prNumber = ctx.payload.pull_request?.number;
  if (!prNumber) {
    core.warning('Pull request number missing from event payload.');
    return;
  }

  const octokit = github.getOctokit(token);
  const { owner, repo } = ctx.repo;

  const existing = await octokit.paginate(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  });
  const sticky = existing.find((c) => c.body?.includes(STICKY_MARKER));

  if (sticky) {
    await octokit.rest.issues.updateComment({ owner, repo, comment_id: sticky.id, body });
    core.info(`Updated sticky comment (id=${sticky.id}).`);
  } else {
    await octokit.rest.issues.createComment({ owner, repo, issue_number: prNumber, body });
    core.info('Created sticky comment.');
  }
}
