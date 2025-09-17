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

export const setUserActiveState = async (userId: number, isActive: boolean) => {
  await ensureUserTable();
  const db = getDb();
  const [result] = await db.query<ResultSetHeader>(
    `UPDATE users SET is_active = ? WHERE id = ?`,
    [isActive ? 1 : 0, userId],
  );

  if (result.affectedRows === 0) {
    throw new Error("Usuário não encontrado.");
  }
};
