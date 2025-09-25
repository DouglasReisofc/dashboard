import bcrypt from "bcryptjs";
import type { ResultSetHeader } from "mysql2";

import { ensureSessionTable, ensureUserTable, getDb, UserRow } from "lib/db";
import { normalizeUserRole } from "lib/auth";
import type { SessionUser } from "types/auth";
import type { AdminUserSummary, UserMetrics } from "types/users";
import { deleteUploadedFile } from "lib/uploads";

const normalizeDate = (value: Date | string) =>
  value instanceof Date ? value : new Date(value);

const normalizeAvatarUrl = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const sanitized = trimmed.replace(/^\/+/, "").replace(/\\/g, "/");
  return `/${sanitized}`;
};

export type UserBasicInfo = {
  id: number;
  name: string;
  email: string;
};

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
    role: normalizeUserRole(row.role),
    isActive: Boolean(row.is_active),
    balance: (() => {
      const parsed = Number.parseFloat(row.balance ?? "0");
      if (Number.isNaN(parsed)) {
        return 0;
      }
      return Math.round(parsed * 100) / 100;
    })(),
    whatsappNumber: row.whatsapp_number ?? null,
    avatarUrl: normalizeAvatarUrl(row.avatar_path ?? null),
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

export const getUserBalanceById = async (userId: number): Promise<number> => {
  await ensureUserTable();
  const db = getDb();

  const [rows] = await db.query<UserRow[]>(
    `SELECT balance FROM users WHERE id = ? LIMIT 1`,
    [userId],
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Usuário não encontrado.");
  }

  const parsed = Number.parseFloat(rows[0].balance ?? "0");
  return Number.isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
};

export const increaseUserBalance = async (userId: number, amount: number): Promise<number> => {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Valor inválido para crédito de saldo.");
  }

  await ensureUserTable();
  const db = getDb();

  await db.query(
    `UPDATE users SET balance = balance + ? WHERE id = ?`,
    [amount, userId],
  );

  return getUserBalanceById(userId);
};

export const decreaseUserBalance = async (userId: number, amount: number): Promise<number> => {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Valor inválido para débito de saldo.");
  }

  await ensureUserTable();
  const db = getDb();

  const [result] = await db.query<ResultSetHeader>(
    `UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?`,
    [amount, userId, amount],
  );

  if (result.affectedRows === 0) {
    throw new Error("Saldo insuficiente para realizar a operação.");
  }

  return getUserBalanceById(userId);
};

export const getUserBasicById = async (userId: number): Promise<UserBasicInfo | null> => {
  await ensureUserTable();
  const db = getDb();

  const [rows] = await db.query<Pick<UserRow, "id" | "name" | "email">[]>(
    `SELECT id, name, email FROM users WHERE id = ? LIMIT 1`,
    [userId],
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    email: row.email,
  } satisfies UserBasicInfo;
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
  whatsappNumber?: string | null;
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

  if (Object.prototype.hasOwnProperty.call(updates, "whatsappNumber")) {
    const value = updates.whatsappNumber;
    const sanitized = typeof value === "string" ? value.trim() : "";
    fields.push("whatsapp_number = ?");
    values.push(sanitized ? sanitized : null);
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

type UserProfileUpdates = {
  name?: string;
  email?: string;
  password?: string;
  whatsappNumber?: string | null;
  avatarPath?: string | null;
};

export const updateUserProfile = async (
  userId: number,
  updates: UserProfileUpdates,
) => {
  await ensureUserTable();
  const db = getDb();

  const [existingRows] = await db.query<UserRow[]>(
    `SELECT * FROM users WHERE id = ? LIMIT 1`,
    [userId],
  );

  if (!Array.isArray(existingRows) || existingRows.length === 0) {
    throw new Error("Usuário não encontrado.");
  }

  const existing = existingRows[0];

  const fields: string[] = [];
  const values: Array<string | number | null> = [];
  let avatarToDelete: string | null = null;

  if (typeof updates.name === "string" && updates.name.trim()) {
    fields.push("name = ?");
    values.push(updates.name.trim());
  }

  if (typeof updates.email === "string" && updates.email.trim()) {
    const normalizedEmail = updates.email.trim().toLowerCase();
    const [existingEmail] = await db.query<RowDataPacket[]>(
      `SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1`,
      [normalizedEmail, userId],
    );

    if (Array.isArray(existingEmail) && existingEmail.length > 0) {
      throw new Error("E-mail já está em uso por outro usuário.");
    }

    fields.push("email = ?");
    values.push(normalizedEmail);
  }

  if (typeof updates.password === "string" && updates.password.trim()) {
    const hashedPassword = await bcrypt.hash(updates.password.trim(), 10);
    fields.push("password = ?");
    values.push(hashedPassword);
  }

  if (Object.prototype.hasOwnProperty.call(updates, "whatsappNumber")) {
    const value = updates.whatsappNumber;
    fields.push("whatsapp_number = ?");
    values.push(value && value.trim() ? value.trim() : null);
  }

  if (Object.prototype.hasOwnProperty.call(updates, "avatarPath")) {
    const value = updates.avatarPath;
    const normalized = value && value.trim() ? value.trim() : null;
    fields.push("avatar_path = ?");
    values.push(normalized);

    if (existing.avatar_path && existing.avatar_path !== normalized) {
      avatarToDelete = existing.avatar_path;
    }

    if (!normalized && existing.avatar_path) {
      avatarToDelete = existing.avatar_path;
    }
  }

  if (fields.length === 0) {
    throw new Error("Nenhuma alteração informada.");
  }

  fields.push("updated_at = CURRENT_TIMESTAMP");

  const [result] = await db.query<ResultSetHeader>(
    `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
    [...values, userId],
  );

  if (result.affectedRows === 0) {
    throw new Error("Usuário não encontrado.");
  }

  if (avatarToDelete) {
    try {
      await deleteUploadedFile(avatarToDelete);
    } catch (error) {
      console.error("Failed to delete previous avatar", error);
    }
  }

  const [rows] = await db.query<UserRow[]>(
    `SELECT id, name, email, whatsapp_number, avatar_path FROM users WHERE id = ? LIMIT 1`,
    [userId],
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Usuário não encontrado após atualização.");
  }

  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    whatsappNumber: row.whatsapp_number ?? null,
    avatarUrl: normalizeAvatarUrl(row.avatar_path ?? null),
  };
};

const sanitizeWhatsappDigits = (value: string) => value.replace(/[^0-9]/g, "");

export const findActiveUserByWhatsappId = async (
  whatsappId: string,
): Promise<SessionUser | null> => {
  const digits = sanitizeWhatsappDigits(whatsappId);
  if (!digits) {
    return null;
  }

  await ensureUserTable();
  const db = getDb();

  const [rows] = await db.query<UserRow[]>(
    `
      SELECT id, name, email, role, is_active, whatsapp_number, avatar_path
      FROM users
      WHERE is_active = 1
        AND whatsapp_number IS NOT NULL
        AND REGEXP_REPLACE(whatsapp_number, '[^0-9]', '') = ?
      LIMIT 1
    `,
    [digits],
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const row = rows[0];

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: normalizeUserRole(row.role),
    isActive: Boolean(row.is_active),
    whatsappNumber: row.whatsapp_number ?? null,
    avatarUrl: normalizeAvatarUrl(row.avatar_path ?? null),
  } satisfies SessionUser;
};

export const getSessionUserById = async (
  userId: number,
): Promise<SessionUser | null> => {
  if (!Number.isFinite(userId) || userId <= 0) {
    return null;
  }

  await ensureUserTable();
  const db = getDb();

  const [rows] = await db.query<UserRow[]>(
    `
      SELECT id, name, email, role, is_active, whatsapp_number, avatar_path
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [userId],
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const row = rows[0];

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: normalizeUserRole(row.role),
    isActive: Boolean(row.is_active),
    whatsappNumber: row.whatsapp_number ?? null,
    avatarUrl: normalizeAvatarUrl(row.avatar_path ?? null),
  } satisfies SessionUser;
};
