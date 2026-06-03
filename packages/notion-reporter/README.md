# refactor-tracker-notion-reporter

A [refactor-tracker](https://www.npmjs.com/package/refactor-tracker) reporter that syncs each snapshot to a Notion database, so your team sees a live page with a donut chart, per-task progress bars, and a details table.

## Install

```bash
pnpm add -D refactor-tracker refactor-tracker-notion-reporter
```

## One-time Notion setup

1. **Create an integration** at https://www.notion.so/profile/integrations and copy the internal integration secret.
2. **Create a database** in the Notion page where the report should live. Add these properties (exact names, exact types):

   | Property | Type |
   |---|---|
   | Task | Title |
   | ID | Text |
   | Description | Text |
   | Tags | Multi-select |
   | Done | Number |
   | Total | Number |
   | Percentage | Number — enable "Show as bar" in the property settings |
   | Δ Last run | Number |
   | Completed | Checkbox |
   | Registered | Date |
   | Completed at | Date |
   | Duration (days) | Number |
   | Last synced | Date |

3. **Connect the integration to the database** via `... → Add connections → <your integration>`.
4. **Copy the database ID and the data source ID.** Notion stores databases as a container of one or more *data sources* (rows live in a data source). The reporter needs both:
   - **Database ID**: from the database URL, `notion.so/<workspace>/<DATABASE_ID>?v=...`. Used as the parent when creating new rows.
   - **Data source ID**: open the database, click `•••` → `Manage data sources` → copy the data source's URL or ID. Used when querying existing rows.

   If you only see one data source (the typical case), it's the database's default one — same content, different ID.
5. **Set up the page layout** (a one-time visual choice — the reporter never touches it):
   - Add a chart block on top of the database. Donut chart, aggregating `Done` vs (`Total` − `Done`).
   - Below it, embed a linked view of the database in **List** or **Table** mode so `Percentage` renders as a progress bar per row.

## Configure refactor-tracker

In your `refactor-tracker.yml`:

```yaml
reporters:
  - type: custom
    module: refactor-tracker-notion-reporter
    token: $NOTION_TOKEN
    databaseId: 1a2b3c4d-5e6f-7890-abcd-ef1234567890
    dataSourceId: 0a1b2c3d-4e5f-6789-abcd-ef9876543210
```

`$NOTION_TOKEN` is expanded from the environment (missing variable is a hard error). The `databaseId` and `dataSourceId` are non-secret; hardcode or env-expand as you prefer.

## What runs on each invocation

For every task in the report, the reporter upserts one row in the Notion database, keyed by `ID`. Rows for tasks no longer in your config are **left alone** — they're not archived or deleted. The reporter prints one summary line: `notion: synced N tasks (X created, Y updated)`.

If any step fails (auth, network, missing property in the database, mismatched IDs) the reporter throws and the `refactor-tracker` CLI exits non-zero. There is no retry — if the failure is transient, re-run the CLI.
