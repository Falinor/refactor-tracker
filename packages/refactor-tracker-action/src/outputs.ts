import * as core from '@actions/core';
import type { Report } from 'refactor-tracker';
import { totalDelta } from './report.js';

export function setOutputs(report: Report): void {
  core.setOutput('delta', totalDelta(report));
  core.setOutput('total', report.tasks.length);
  core.setOutput('has-changes', report.hasChanges ? 'true' : 'false');
  core.setOutput('report-json', JSON.stringify(report));
}

export function hasRegression(report: Report): boolean {
  return report.tasks.some((t) => t.delta !== null && t.delta < 0);
}
