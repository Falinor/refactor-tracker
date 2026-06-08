export interface TaskResult {
  id: string;
  name: string;
  description?: string; // optional one-line context for the refactor
  tags?: string[];
  done: number;
  total: number;
  percentage: number; // 0–100, rounded
  delta: number | null; // change in `done` vs previous run; null on first run
  items?: string[]; // present iff list command ran and returned items
  registeredAt: string | null; // ISO-8601; null only for pre-upgrade refactors without YAML override
  completedAt: string | null; // ISO-8601; null until first 100%
  durationDays: number | null; // integer days, computed when both timestamps exist
}

export interface Report {
  tasks: TaskResult[];
  timestamp: string; // ISO-8601
  hasChanges: boolean;
}

export interface Reporter {
  report(report: Report): Promise<void>;
  // When true, the CLI passes the unfiltered Report — used by the JSON reporter
  // so the on-disk artifact stays a faithful machine copy regardless of view flags.
  wantsRaw?: boolean;
}
