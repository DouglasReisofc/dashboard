import { ResultSetHeader, RowDataPacket } from "mysql2";

import { ensureCustomerTable, ensureUserPurchaseHistoryTable, getDb, UserPurchaseHistoryRow } from "lib/db";
import type { PurchaseHistoryEntry, PurchaseMetadata } from "types/purchases";

const mapPurchaseRow = (row: UserPurchaseHistoryRow): PurchaseHistoryEntry => ({
  id: row.id,
  userId: row.user_id,
  customerId: row.customer_id,
  customerWhatsapp: row.customer_whatsapp,
  customerName: row.customer_name,
  categoryId: row.category_id,
  categoryName: row.category_name,
  categoryPrice: Number.parseFloat(row.category_price ?? "0"),
  categoryDescription: row.category_description,
  productId: row.product_id,
  productDetails: row.product_details,
  productFilePath: row.product_file_path,
  currency: row.currency,
  metadata: (() => {
    if (!row.metadata) {
      return null;
    }
    try {
      const parsed = JSON.parse(row.metadata);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as PurchaseMetadata;
      }
    } catch (error) {
      console.warn("Failed to parse purchase metadata", error);
    }
    return null;
  })(),
  purchasedAt: row.purchased_at instanceof Date
    ? row.purchased_at.toISOString()
    : new Date(row.purchased_at).toISOString(),
});

type RecordPurchasePayload = {
  userId: number;
  customerId: number | null;
  customerWhatsapp: string | null;
  customerName: string | null;
  categoryId: number | null;
  categoryName: string;
  categoryPrice: number;
  categoryDescription: string | null;
  productId: number | null;
  productDetails: string;
  productFilePath: string | null;
  currency?: string;
  metadata?: Record<string, unknown> | null;
};

export const recordPurchaseHistoryEntry = async (payload: RecordPurchasePayload): Promise<void> => {
  await ensureCustomerTable();
  await ensureUserPurchaseHistoryTable();
  const db = getDb();

  const metadataString = payload.metadata ? JSON.stringify(payload.metadata) : null;

  await db.query<ResultSetHeader>(
    `
      INSERT INTO user_purchase_history (
        user_id,
        customer_id,
        customer_whatsapp,
        customer_name,
        category_id,
        category_name,
        category_price,
        category_description,
        product_id,
        product_details,
        product_file_path,
        currency,
        metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.userId,
      payload.customerId,
      payload.customerWhatsapp,
      payload.customerName,
      payload.categoryId,
      payload.categoryName,
      Number(payload.categoryPrice.toFixed(2)),
      payload.categoryDescription,
      payload.productId,
      payload.productDetails,
      payload.productFilePath,
      payload.currency ?? "BRL",
      metadataString,
    ],
  );
};

export const getPurchaseHistoryForUser = async (
  userId: number,
  limit = 50,
): Promise<PurchaseHistoryEntry[]> => {
  await ensureUserPurchaseHistoryTable();
  const db = getDb();

  const [rows] = await db.query<UserPurchaseHistoryRow[]>(
    `
      SELECT *
      FROM user_purchase_history
      WHERE user_id = ?
      ORDER BY purchased_at DESC, id DESC
      LIMIT ?
    `,
    [userId, limit],
  );

  return rows.map(mapPurchaseRow);
};

const parsePurchaseMetadata = (raw: string | null): PurchaseMetadata | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as PurchaseMetadata;
    }
  } catch (error) {
    console.warn("Failed to parse purchase metadata", error);
  }

  return null;
};

const normalizePurchaseNote = (note: string): string => note.trim();

const serializePurchaseMetadata = (metadata: PurchaseMetadata | null): string | null => {
  if (!metadata || Object.keys(metadata).length === 0) {
    return null;
  }

  return JSON.stringify(metadata);
};

export const updatePurchaseAdminNote = async (
  userId: number,
  purchaseId: number,
  adminNote: string,
): Promise<PurchaseHistoryEntry | null> => {
  await ensureUserPurchaseHistoryTable();
  const db = getDb();

  const [rows] = await db.query<UserPurchaseHistoryRow[]>(
    `SELECT * FROM user_purchase_history WHERE id = ? AND user_id = ? LIMIT 1`,
    [purchaseId, userId],
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const currentRow = rows[0];
  const existingMetadata = parsePurchaseMetadata(currentRow.metadata);
  const normalizedNote = normalizePurchaseNote(adminNote);
  let nextMetadata: PurchaseMetadata | null = existingMetadata ? { ...existingMetadata } : null;

  if (normalizedNote.length > 0) {
    nextMetadata = nextMetadata ? { ...nextMetadata, adminNote: normalizedNote } : { adminNote: normalizedNote };
  } else if (nextMetadata) {
    const rest: PurchaseMetadata = { ...nextMetadata };
    delete rest.adminNote;
    nextMetadata = Object.keys(rest).length > 0 ? rest : null;
  }

  const metadataString = serializePurchaseMetadata(nextMetadata);

  await db.query(
    `
      UPDATE user_purchase_history
      SET metadata = ?
      WHERE id = ? AND user_id = ?
    `,
    [metadataString, purchaseId, userId],
  );

  const [updatedRows] = await db.query<UserPurchaseHistoryRow[]>(
    `SELECT * FROM user_purchase_history WHERE id = ? AND user_id = ? LIMIT 1`,
    [purchaseId, userId],
  );

  if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
    return null;
  }

  return mapPurchaseRow(updatedRows[0]);
};

export const getPurchaseStatsForUser = async (
  userId: number,
): Promise<{ totalSales: number; totalRevenue: number }> => {
  await ensureUserPurchaseHistoryTable();
  const db = getDb();

  const [rows] = await db.query<RowDataPacket[]>(
    `
      SELECT
        COUNT(*) AS total_sales,
        COALESCE(SUM(category_price), 0) AS total_revenue
      FROM user_purchase_history
      WHERE user_id = ?
    `,
    [userId],
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      totalSales: 0,
      totalRevenue: 0,
    };
  }

  const row = rows[0];
  const totalSalesRaw = row.total_sales;
  const totalRevenueRaw = row.total_revenue;

  return {
    totalSales: typeof totalSalesRaw === "number"
      ? totalSalesRaw
      : Number.parseInt(String(totalSalesRaw ?? 0), 10) || 0,
    totalRevenue: typeof totalRevenueRaw === "number"
      ? Number(totalRevenueRaw)
      : Number.parseFloat(String(totalRevenueRaw ?? 0)) || 0,
  };
};
