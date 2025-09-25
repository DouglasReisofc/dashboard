import { ResultSetHeader } from "mysql2";

import {
  CustomerRow,
  ensureCustomerTable,
  getDb,
} from "lib/db";
import type {
  CustomerInteractionPayload,
  CustomerSummary,
  CustomerUpdateInput,
  DebitCustomerBalanceResult,
  CreditCustomerBalanceResult,
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

export const findCustomerByWhatsappForUser = async (
  userId: number,
  whatsappId: string,
): Promise<CustomerSummary | null> => {
  const normalizedWhatsappId = whatsappId.trim();

  if (!normalizedWhatsappId) {
    return null;
  }

  await ensureCustomerTable();
  const db = getDb();

  const [rows] = await db.query<CustomerRow[]>(
    `SELECT * FROM customers WHERE user_id = ? AND whatsapp_id = ? LIMIT 1`,
    [userId, normalizedWhatsappId],
  );

  if (rows.length === 0) {
    return null;
  }

  return mapCustomerRow(rows[0]);
};

export const findCustomerByPhoneForUser = async (
  userId: number,
  phone: string,
): Promise<CustomerSummary | null> => {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    return null;
  }

  await ensureCustomerTable();
  const db = getDb();

  const [rows] = await db.query<CustomerRow[]>(
    `
      SELECT *
      FROM customers
      WHERE user_id = ? AND (phone_number = ? OR whatsapp_id = ?)
      LIMIT 1
    `,
    [userId, normalizedPhone, normalizedPhone],
  );

  if (rows.length === 0) {
    return null;
  }

  return mapCustomerRow(rows[0]);
};

const sanitizeBalance = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const rounded = Number.parseFloat(value.toFixed(2));
  return Number.isFinite(rounded) ? Math.max(rounded, 0) : 0;
};

const parseDatabaseBalance = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
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

const ensureCustomerRecord = async (
  userId: number,
  whatsappId: string,
  options?: { displayName?: string | null; phoneNumber?: string | null },
) => {
  await ensureCustomerTable();
  const db = getDb();

  const normalizedPhone = options?.phoneNumber?.trim()
    ? normalizePhone(options.phoneNumber)
    : normalizePhone(whatsappId);
  const phoneNumber = normalizedPhone || whatsappId;
  const displayName = options?.displayName?.trim() || null;

  await db.query(
    `
      INSERT INTO customers (user_id, whatsapp_id, phone_number, display_name, balance)
      VALUES (?, ?, ?, ?, 0)
      ON DUPLICATE KEY UPDATE
        phone_number = CASE
          WHEN VALUES(phone_number) IS NOT NULL AND VALUES(phone_number) <> '' THEN VALUES(phone_number)
          ELSE phone_number
        END,
        display_name = CASE
          WHEN VALUES(display_name) IS NOT NULL AND VALUES(display_name) <> '' THEN VALUES(display_name)
          ELSE display_name
        END,
        updated_at = CURRENT_TIMESTAMP
    `,
    [userId, whatsappId, phoneNumber, displayName],
  );
};

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

export const debitCustomerBalanceByWhatsapp = async (
  userId: number,
  whatsappId: string,
  amount: number,
): Promise<DebitCustomerBalanceResult> => {
  const normalizedWhatsappId = whatsappId.trim();

  if (!normalizedWhatsappId) {
    return { success: false, balance: 0, reason: "not_found" };
  }

  await ensureCustomerTable();
  const db = getDb();

  const [rows] = await db.query<CustomerRow[]>(
    `SELECT * FROM customers WHERE user_id = ? AND whatsapp_id = ? LIMIT 1`,
    [userId, normalizedWhatsappId],
  );

  if (rows.length === 0) {
    return { success: false, balance: 0, reason: "not_found" };
  }

  const customerRow = rows[0];
  const currentBalance = parseDatabaseBalance(customerRow.balance);
  const customerSummary = mapCustomerRow(customerRow);

  if (customerRow.is_blocked === 1) {
    return {
      success: false,
      balance: currentBalance,
      customer: customerSummary,
      reason: "blocked",
    };
  }

  const normalizedAmount = sanitizeBalance(amount);

  if (normalizedAmount <= 0) {
    return {
      success: true,
      balance: currentBalance,
      customer: customerSummary,
    };
  }

  if (currentBalance < normalizedAmount) {
    return {
      success: false,
      balance: currentBalance,
      customer: customerSummary,
      reason: "insufficient",
    };
  }

  const [result] = await db.query<ResultSetHeader>(
    `
      UPDATE customers
      SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ? AND balance >= ? AND is_blocked = 0
    `,
    [normalizedAmount.toFixed(2), customerRow.id, userId, normalizedAmount.toFixed(2)],
  );

  if (result.affectedRows === 0) {
    return {
      success: false,
      balance: currentBalance,
      customer: customerSummary,
      reason: "insufficient",
    };
  }

  const [updatedRows] = await db.query<CustomerRow[]>(
    `SELECT * FROM customers WHERE id = ? LIMIT 1`,
    [customerRow.id],
  );

  const updatedRow = updatedRows[0] ?? customerRow;
  const updatedSummary = mapCustomerRow(updatedRow);

  return {
    success: true,
    balance: updatedSummary.balance,
    customer: updatedSummary,
  };
};

export const creditCustomerBalanceByWhatsapp = async (
  userId: number,
  whatsappId: string,
  amount: number,
  options?: { displayName?: string | null; phoneNumber?: string | null },
): Promise<CreditCustomerBalanceResult> => {
  const normalizedWhatsappId = whatsappId.trim();

  if (!normalizedWhatsappId) {
    return { success: false, balance: 0, reason: "invalid_amount" };
  }

  const normalizedAmount = sanitizeBalance(amount);

  if (normalizedAmount <= 0) {
    return { success: false, balance: 0, reason: "invalid_amount" };
  }

  await ensureCustomerRecord(userId, normalizedWhatsappId, options);
  const db = getDb();

  await db.query(
    `
      UPDATE customers
      SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND whatsapp_id = ?
    `,
    [normalizedAmount.toFixed(2), userId, normalizedWhatsappId],
  );

  const [rows] = await db.query<CustomerRow[]>(
    `SELECT * FROM customers WHERE user_id = ? AND whatsapp_id = ? LIMIT 1`,
    [userId, normalizedWhatsappId],
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, balance: 0, reason: "not_found" };
  }

  const summary = mapCustomerRow(rows[0]);

  return {
    success: true,
    balance: summary.balance,
    customer: summary,
  };
};
