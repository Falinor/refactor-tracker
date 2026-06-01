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
}

export interface Report {
  tasks: TaskResult[];
  timestamp: string; // ISO-8601
  hasChanges: boolean;
}

export interface Reporter {
  report(report: Report): Promise<void>;
}
