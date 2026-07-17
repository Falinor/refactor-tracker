export type ExampleKind = 'counts' | 'remaining' | 'binary';
export type ReporterKind = 'stdout' | 'json' | 'markdown' | 'html' | 'badge' | 'none';

export interface RenderConfigOptions {
  schemaUrl: string;
  examples: ExampleKind[];
  reporter: ReporterKind;
}

const EXAMPLE_BLOCKS: Record<ExampleKind, string> = {
  counts: `  # done/total shape: count finished vs the whole population.
  - id: example-counts
    name: Migrate to the new API
    detect:
      done: { command: "grep -rl 'newApi(' src | wc -l" }
      total: { command: "grep -rl 'Api(' src | wc -l" }`,
  remaining: `  # remaining shape: count what's left; pair with total (done is inferred).
  - id: example-remaining
    name: Remove deprecated helper
    detect:
      remaining: { command: "grep -rl 'oldHelper(' src | wc -l" }
      total: { command: "grep -rl 'Helper(' src | wc -l" }`,
  binary: `  # binary shape: done when the command exits 0 (1/1), else 0/1.
  - id: example-binary
    name: No TODO markers left
    detect:
      binary: true
      command: "! grep -rq 'TODO' src"`,
};

const DEFAULT_OUTPUT: Record<'json' | 'markdown' | 'html' | 'badge', string> = {
  json: 'refactor-progress.json',
  markdown: 'refactor-progress.md',
  html: 'refactor-progress.html',
  badge: 'badge.svg',
};

const COMMENTED_REPORTERS = `# reporters:        # default is stdout; uncomment to add file/HTML outputs.
#   - type: markdown
#     output: refactor-progress.md`;

function reporterBlock(reporter: ReporterKind): string {
  if (reporter === 'stdout' || reporter === 'none') return COMMENTED_REPORTERS;
  return `reporters:
  - type: ${reporter}
    output: ${DEFAULT_OUTPUT[reporter]}`;
}

export function renderConfig(opts: RenderConfigOptions): string {
  const blocks = opts.examples.map((kind) => EXAMPLE_BLOCKS[kind]);
  return `# yaml-language-server: $schema=${opts.schemaUrl}

# refactor-tracker config. Each refactor runs shell command(s) that print a
# non-negative integer; the tool counts progress and reports it. Edit the
# example commands below to match your codebase, then run \`refactor-tracker\`.
refactors:
${blocks.join('\n\n')}

${reporterBlock(opts.reporter)}
`;
}
