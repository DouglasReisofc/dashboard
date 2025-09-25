import {
  AdminBotSessionRow,
  ensureAdminBotSessionTable,
  getDb,
} from "./db";

export type AdminBotFlowState =
  | { name: "category_rename_input"; categoryId: number }
  | { name: "category_price_input"; categoryId: number }
  | { name: "category_sku_input"; categoryId: number }
  | { name: "customer_lookup_input"; mode: "edit" }
  | { name: "customer_edit_menu"; customerId: number }
  | { name: "customer_edit_name_input"; customerId: number }
  | { name: "customer_edit_balance_input"; customerId: number };

export type AdminBotSession = {
  whatsappId: string;
  whatsappE164: string;
  userId: number;
  flowState: AdminBotFlowState | null;
  createdAt: string;
  lastInteractionAt: string;
};

const mapSessionRow = (row: AdminBotSessionRow): AdminBotSession => ({
  whatsappId: row.whatsapp_id,
  whatsappE164: row.whatsapp_e164,
  userId: row.user_id,
  flowState: (() => {
    const stateName = row.flow_state?.trim();
    if (!stateName) {
      return null;
    }

    try {
      const parsed = row.flow_context ? JSON.parse(row.flow_context) : null;
      if (!parsed || typeof parsed !== "object" || parsed.name !== stateName) {
        return null;
      }

      switch (stateName) {
        case "category_rename_input":
        case "category_price_input":
        case "category_sku_input": {
          const categoryId = Number.parseInt(String(parsed.categoryId ?? parsed.data?.categoryId ?? parsed.category_id ?? parsed.data?.category_id ?? ""), 10);
          if (Number.isFinite(categoryId)) {
            return { name: stateName, categoryId } as AdminBotFlowState;
          }
          return null;
        }
        case "customer_lookup_input": {
          return { name: "customer_lookup_input", mode: "edit" };
        }
        case "customer_edit_menu":
        case "customer_edit_name_input":
        case "customer_edit_balance_input": {
          const customerId = Number.parseInt(String(parsed.customerId ?? parsed.data?.customerId ?? parsed.customer_id ?? parsed.data?.customer_id ?? ""), 10);
          if (Number.isFinite(customerId)) {
            return { name: stateName, customerId } as AdminBotFlowState;
          }
          return null;
        }
        default:
          return null;
      }
    } catch (error) {
      console.error("Failed to parse admin bot flow context", error);
      return null;
    }
  })(),
  createdAt: row.created_at instanceof Date
    ? row.created_at.toISOString()
    : new Date(row.created_at).toISOString(),
  lastInteractionAt: row.last_interaction_at instanceof Date
    ? row.last_interaction_at.toISOString()
    : new Date(row.last_interaction_at).toISOString(),
});

const sanitizeWhatsappId = (value: string) => value.replace(/[^0-9]/g, "");

export const getAdminBotSession = async (
  whatsappId: string,
): Promise<AdminBotSession | null> => {
  const normalized = sanitizeWhatsappId(whatsappId);
  if (!normalized) {
    return null;
  }

  await ensureAdminBotSessionTable();
  const db = getDb();

  const [rows] = await db.query<AdminBotSessionRow[]>(
    `SELECT * FROM admin_bot_sessions WHERE whatsapp_id = ? LIMIT 1`,
    [normalized],
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return mapSessionRow(rows[0]);
};

export const upsertAdminBotSession = async (
  whatsappId: string,
  userId: number,
): Promise<AdminBotSession> => {
  const normalized = sanitizeWhatsappId(whatsappId);
  if (!normalized) {
    throw new Error("Identificador de WhatsApp inválido.");
  }

  await ensureAdminBotSessionTable();
  const db = getDb();

  await db.query(
    `
      INSERT INTO admin_bot_sessions (whatsapp_id, whatsapp_e164, user_id)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        user_id = VALUES(user_id),
        whatsapp_e164 = VALUES(whatsapp_e164),
        last_interaction_at = CURRENT_TIMESTAMP
    `,
    [normalized, normalized, userId],
  );

  const [rows] = await db.query<AdminBotSessionRow[]>(
    `SELECT * FROM admin_bot_sessions WHERE whatsapp_id = ? LIMIT 1`,
    [normalized],
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Não foi possível criar a sessão do bot administrativo.");
  }

  return mapSessionRow(rows[0]);
};

export const touchAdminBotSession = async (whatsappId: string) => {
  const normalized = sanitizeWhatsappId(whatsappId);
  if (!normalized) {
    return;
  }

  await ensureAdminBotSessionTable();
  const db = getDb();

  await db.query(
    `
      UPDATE admin_bot_sessions
      SET last_interaction_at = CURRENT_TIMESTAMP
      WHERE whatsapp_id = ?
    `,
    [normalized],
  );
};

export const removeAdminBotSession = async (whatsappId: string) => {
  const normalized = sanitizeWhatsappId(whatsappId);
  if (!normalized) {
    return;
  }

  await ensureAdminBotSessionTable();
  const db = getDb();

  await db.query(
    `DELETE FROM admin_bot_sessions WHERE whatsapp_id = ?`,
    [normalized],
  );
};

export const updateAdminBotSessionFlow = async (
  whatsappId: string,
  flow: AdminBotFlowState | null,
) => {
  const normalized = sanitizeWhatsappId(whatsappId);
  if (!normalized) {
    return;
  }

  await ensureAdminBotSessionTable();
  const db = getDb();

  const flowState = flow ? flow.name : null;
  const flowContext = flow ? JSON.stringify(flow) : null;

  await db.query(
    `
      UPDATE admin_bot_sessions
      SET
        flow_state = ?,
        flow_context = ?,
        last_interaction_at = CURRENT_TIMESTAMP
      WHERE whatsapp_id = ?
    `,
    [flowState, flowContext, normalized],
  );
};
