import bcrypt from "bcryptjs";
import type { ResultSetHeader } from "mysql2";

import { ensureSessionTable, ensureUserTable, getDb, UserRow } from "lib/db";
import type { AdminUserSummary, UserMetrics } from "types/users";

const normalizeDate = (value: Date | string) =>
  value instanceof Date ? value : new Date(value);

export const getAdminUsers = async (): Promise<AdminUserSummary[]> => {
  await ensureSessionTable();
  const db = getDb();

  const [rows] = await db.query<
    (UserRow & {
      active_sessions: number | null;
      last_session_at: Date | string | null;
    })[]
  >(
    `
      SELECT
        u.*, 
        SUM(CASE WHEN s.revoked_at IS NULL AND s.expires_at > NOW() THEN 1 ELSE 0 END) AS active_sessions,
        MAX(CASE WHEN s.revoked_at IS NULL THEN s.created_at ELSE NULL END) AS last_session_at
      FROM users u
      LEFT JOIN sessions s ON s.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `,
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isActive: Boolean(row.is_active),
    balance: (() => {
      const parsed = Number.parseFloat(row.balance ?? "0");
      if (Number.isNaN(parsed)) {
        return 0;
      }
      return Math.round(parsed * 100) / 100;
    })(),
    createdAt: normalizeDate(row.created_at).toISOString(),
    updatedAt: normalizeDate(row.updated_at).toISOString(),
    activeSessions: Number(row.active_sessions ?? 0),
    lastSessionAt: row.last_session_at
      ? normalizeDate(row.last_session_at).toISOString()
      : null,
  }));
};

export const getAdminUserById = async (
  userId: number,
): Promise<AdminUserSummary | null> => {
  const users = await getAdminUsers();
  return users.find((user) => user.id === userId) ?? null;
};

export const getUserMetrics = async (): Promise<UserMetrics> => {
  const users = await getAdminUsers();

  const totalUsers = users.length;
  const activeUsers = users.filter((user) => user.isActive).length;
  const inactiveUsers = totalUsers - activeUsers;
  const activeSessions = users.reduce(
    (total, user) => total + user.activeSessions,
    0,
  );

  return {
    totalUsers,
    activeUsers,
    inactiveUsers,
    activeSessions,
  } satisfies UserMetrics;
};

type AdminUpdatableFields = {
  name?: string;
  email?: string;
  role?: "admin" | "user";
  password?: string;
  isActive?: boolean;
  balance?: number;
};

export const updateAdminUser = async (
  userId: number,
  updates: AdminUpdatableFields,
) => {
  await ensureUserTable();
  const db = getDb();

  const fields: string[] = [];
  const values: Array<string | number> = [];

  if (typeof updates.name === "string" && updates.name.trim().length > 0) {
    fields.push("name = ?");
    values.push(updates.name.trim());
  }

  if (typeof updates.email === "string" && updates.email.trim().length > 0) {
    fields.push("email = ?");
    values.push(updates.email.trim().toLowerCase());
  }

  if (updates.role === "admin" || updates.role === "user") {
    fields.push("role = ?");
    values.push(updates.role);
  }

  if (typeof updates.isActive === "boolean") {
    fields.push("is_active = ?");
    values.push(updates.isActive ? 1 : 0);
  }

  if (
    typeof updates.balance === "number" &&
    Number.isFinite(updates.balance) &&
    updates.balance >= 0
  ) {
    const normalizedBalance = Math.round(updates.balance * 100) / 100;
    fields.push("balance = ?");
    values.push(normalizedBalance);
  }

  if (typeof updates.password === "string" && updates.password.length > 0) {
    const hashedPassword = await bcrypt.hash(updates.password, 10);
    fields.push("password = ?");
    values.push(hashedPassword);
  }

  if (fields.length === 0) {
    return;
  }

  fields.push("updated_at = CURRENT_TIMESTAMP");

  const [result] = await db.query<ResultSetHeader>(
    `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
    [...values, userId],
  );

  if (result.affectedRows === 0) {
    throw new Error("Usuário não encontrado.");
  }
};
