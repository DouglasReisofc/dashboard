import {
  CustomerRow,
  ensureCustomerTable,
  getDb,
} from "lib/db";
import type {
  CustomerInteractionPayload,
  CustomerSummary,
  CustomerUpdateInput,
} from "types/customers";

const mapCustomerRow = (row: CustomerRow): CustomerSummary => ({
  id: row.id,
  userId: row.user_id,
  whatsappId: row.whatsapp_id,
  phoneNumber: row.phone_number,
  displayName: row.display_name,
  profileName: row.profile_name,
  notes: row.notes,
  balance: Number.parseFloat(row.balance ?? "0") || 0,
  isBlocked: row.is_blocked === 1,
  lastInteraction: row.last_interaction ? row.last_interaction.toISOString() : null,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export const getCustomersForUser = async (
  userId: number,
): Promise<CustomerSummary[]> => {
  await ensureCustomerTable();
  const db = getDb();

  const [rows] = await db.query<CustomerRow[]>(
    `
      SELECT *
      FROM customers
      WHERE user_id = ?
      ORDER BY COALESCE(last_interaction, created_at) DESC, id DESC
    `,
    [userId],
  );

  return rows.map(mapCustomerRow);
};

export const getCustomerByIdForUser = async (
  userId: number,
  customerId: number,
): Promise<CustomerRow | null> => {
  await ensureCustomerTable();
  const db = getDb();

  const [rows] = await db.query<CustomerRow[]>(
    `SELECT * FROM customers WHERE id = ? AND user_id = ? LIMIT 1`,
    [customerId, userId],
  );

  return rows.length ? rows[0] : null;
};

const sanitizeBalance = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const rounded = Number.parseFloat(value.toFixed(2));
  return Number.isFinite(rounded) ? Math.max(rounded, 0) : 0;
};

export const updateCustomerForUser = async (
  userId: number,
  customerId: number,
  input: CustomerUpdateInput,
): Promise<CustomerSummary | null> => {
  await ensureCustomerTable();
  const db = getDb();

  const customer = await getCustomerByIdForUser(userId, customerId);
  if (!customer) {
    return null;
  }

  const normalizedBalance = sanitizeBalance(input.balance);
  const displayName = input.displayName?.trim() || null;
  const notes = input.notes?.trim() || null;
  const isBlocked = input.isBlocked ? 1 : 0;

  await db.query(
    `
      UPDATE customers
      SET
        display_name = ?,
        notes = ?,
        balance = ?,
        is_blocked = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `,
    [displayName, notes, normalizedBalance, isBlocked, customerId, userId],
  );

  const [rows] = await db.query<CustomerRow[]>(
    `SELECT * FROM customers WHERE id = ? AND user_id = ? LIMIT 1`,
    [customerId, userId],
  );

  return rows.length ? mapCustomerRow(rows[0]) : null;
};

const normalizePhone = (phone: string) => phone.replace(/[^0-9+]/g, "");

export const upsertCustomerInteraction = async (
  payload: CustomerInteractionPayload,
) => {
  const { userId, whatsappId } = payload;
  const trimmedWhatsappId = whatsappId.trim();

  if (!trimmedWhatsappId) {
    return;
  }

  await ensureCustomerTable();
  const db = getDb();

  const rawPhone = payload.phoneNumber?.trim() ?? trimmedWhatsappId;
  const normalizedPhone = rawPhone ? normalizePhone(rawPhone) : "";
  const phoneNumber = normalizedPhone || trimmedWhatsappId;

  const timestamp =
    typeof payload.messageTimestamp === "number" && Number.isFinite(payload.messageTimestamp)
      ? new Date(payload.messageTimestamp * 1000)
      : new Date();

  await db.query(
    `
      INSERT INTO customers (user_id, whatsapp_id, phone_number, profile_name, last_interaction)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        phone_number = VALUES(phone_number),
        profile_name = CASE
          WHEN VALUES(profile_name) IS NOT NULL AND VALUES(profile_name) <> '' THEN VALUES(profile_name)
          ELSE profile_name
        END,
        last_interaction = CASE
          WHEN VALUES(last_interaction) IS NULL THEN last_interaction
          WHEN last_interaction IS NULL THEN VALUES(last_interaction)
          WHEN VALUES(last_interaction) > last_interaction THEN VALUES(last_interaction)
          ELSE last_interaction
        END,
        updated_at = CURRENT_TIMESTAMP
    `,
    [userId, trimmedWhatsappId, phoneNumber || trimmedWhatsappId, payload.profileName ?? null, timestamp],
  );
};
