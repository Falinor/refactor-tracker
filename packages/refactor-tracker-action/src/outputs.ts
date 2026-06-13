import * as core from '@actions/core';
import type { Report } from 'refactor-tracker';

export function setOutputs(report: Report): void {
  const totalDelta = report.tasks.reduce((sum, t) => sum + (t.delta ?? 0), 0);
  core.setOutput('delta', totalDelta);
  core.setOutput('total', report.tasks.length);
  core.setOutput('has-changes', report.hasChanges ? 'true' : 'false');
  core.setOutput('report-json', JSON.stringify(report));
}

export function hasRegression(report: Report): boolean {
  return report.tasks.some((t) => t.delta !== null && t.delta < 0);
}
