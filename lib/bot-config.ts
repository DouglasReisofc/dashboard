import { ResultSetHeader } from "mysql2";

import type { BotMenuConfig } from "types/bot";

import { BotMenuConfigRow, ensureBotMenuConfigTable, getDb } from "./db";

const mapRow = (row: BotMenuConfigRow): BotMenuConfig => {
  let variables: string[] = [];

  if (row.variables) {
    try {
      const parsed = JSON.parse(row.variables) as unknown;
      if (Array.isArray(parsed)) {
        variables = parsed
          .map((value) => (typeof value === "string" ? value.trim() : ""))
          .filter((value) => value.length > 0);
      }
    } catch (error) {
      console.warn("Failed to parse bot menu variables", error);
    }
  }

  return {
    id: row.id,
    userId: row.user_id,
    menuText: row.menu_text,
    variables,
    imagePath: row.image_path,
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : new Date(row.updated_at).toISOString(),
  } satisfies BotMenuConfig;
};

export const getBotMenuConfigForUser = async (
  userId: number,
): Promise<BotMenuConfig | null> => {
  await ensureBotMenuConfigTable();
  const db = getDb();
  const [rows] = await db.query<BotMenuConfigRow[]>(
    `SELECT * FROM bot_menu_configs WHERE user_id = ? LIMIT 1`,
    [userId],
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return mapRow(rows[0]);
};

export const upsertBotMenuConfig = async (payload: {
  userId: number;
  menuText: string;
  variables: string[];
  imagePath: string | null;
}): Promise<BotMenuConfig> => {
  await ensureBotMenuConfigTable();
  const db = getDb();

  const normalizedVariables = payload.variables
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const serializedVariables = JSON.stringify(normalizedVariables);

  await db.query<ResultSetHeader>(
    `
      INSERT INTO bot_menu_configs (user_id, menu_text, variables, image_path)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        menu_text = VALUES(menu_text),
        variables = VALUES(variables),
        image_path = VALUES(image_path)
    `,
    [payload.userId, payload.menuText, serializedVariables, payload.imagePath],
  );

  const updated = await getBotMenuConfigForUser(payload.userId);

  if (!updated) {
    throw new Error("Failed to persist bot menu configuration");
  }

  return updated;
};
