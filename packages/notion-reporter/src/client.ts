import { Client, type PageObjectResponse } from '@notionhq/client';

export interface NotionPage {
  id: string;
  properties: Record<string, unknown>;
}

export interface NotionClient {
  queryByIds(dataSourceId: string, idPropertyName: string, ids: string[]): Promise<NotionPage[]>;
  createPage(databaseId: string, properties: Record<string, unknown>): Promise<void>;
  updatePage(pageId: string, properties: Record<string, unknown>): Promise<void>;
}

export function createOfficialNotionClient(token: string): NotionClient {
  const client = new Client({ auth: token });

  return {
    async queryByIds(dataSourceId, idPropertyName, ids) {
      if (ids.length === 0) return [];
      const results: NotionPage[] = [];
      let cursor: string | undefined;
      do {
        const res = await client.dataSources.query({
          data_source_id: dataSourceId,
          filter: {
            or: ids.map((id) => ({
              property: idPropertyName,
              rich_text: { equals: id },
            })),
          },
          start_cursor: cursor,
        });
        for (const page of res.results) {
          if ('properties' in page) {
            const full = page as PageObjectResponse;
            results.push({ id: full.id, properties: full.properties });
          }
        }
        cursor = res.next_cursor ?? undefined;
      } while (cursor);
      return results;
    },

    async createPage(databaseId, properties) {
      await client.pages.create({
        parent: { database_id: databaseId },
        // The Notion SDK types `properties` as a discriminated union; the reporter
        // builds raw Notion property values, so this cast is intentional.
        properties: properties as never,
      });
    },

    async updatePage(pageId, properties) {
      await client.pages.update({
        page_id: pageId,
        properties: properties as never,
      });
    },
  };
}
