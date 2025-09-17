import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cache } from "react";

import {
  ensureSessionTable,
  ensureUserTable,
  getDb,
  SessionRow,
  UserRow,
} from "lib/db";
import type { SessionUser } from "types/auth";

export const SESSION_COOKIE = "sb_session";
const SESSION_TTL_DAYS = 7;

const baseCookieConfig = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

const getExpirationDate = () => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);
  return expiresAt;
};

const toSeconds = (milliseconds: number) => Math.max(Math.floor(milliseconds / 1000), 0);

export const setSessionCookie = (
  response: NextResponse,
  sessionId: string,
  expiresAt: Date,
) => {
  const maxAge = toSeconds(expiresAt.getTime() - Date.now());

  response.cookies.set({
    name: SESSION_COOKIE,
    value: sessionId,
    maxAge,
    ...baseCookieConfig,
  });
};

export const clearSessionCookie = (response: NextResponse) => {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    maxAge: 0,
    ...baseCookieConfig,
  });
};

export const createSession = async (userId: number) => {
  await ensureSessionTable();
  const db = getDb();
  const sessionId = randomUUID();
  const expiresAt = getExpirationDate();

  await db.query(
    `
      INSERT INTO sessions (id, user_id, expires_at)
      VALUES (?, ?, ?)
    `,
    [sessionId, userId, expiresAt],
  );

  return { id: sessionId, expiresAt };
};

export const revokeSession = async (sessionId: string) => {
  await ensureSessionTable();
  const db = getDb();
  await db.query(
    `
      UPDATE sessions
      SET revoked_at = NOW()
      WHERE id = ?
    `,
    [sessionId],
  );
};

export const revokeSessionsForUser = async (userId: number) => {
  await ensureSessionTable();
  const db = getDb();
  await db.query(
    `
      UPDATE sessions
      SET revoked_at = NOW()
      WHERE user_id = ? AND revoked_at IS NULL
    `,
    [userId],
  );
};

const normalizeDate = (value: Date | string) =>
  value instanceof Date ? value : new Date(value);

const findActiveSession = async (
  sessionId: string,
): Promise<SessionRow | null> => {
  await ensureSessionTable();
  const db = getDb();
  const [sessions] = await db.query<SessionRow[]>(
    `SELECT * FROM sessions WHERE id = ? LIMIT 1`,
    [sessionId],
  );

  if (!sessions.length) {
    return null;
  }

  const session = sessions[0];
  const expiresAt = normalizeDate(session.expires_at);
  const revokedAt = session.revoked_at ? normalizeDate(session.revoked_at) : null;

  if (revokedAt || expiresAt.getTime() <= Date.now()) {
    await db.query(`DELETE FROM sessions WHERE id = ?`, [sessionId]);
    return null;
  }

  return session;
};

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionId) {
    return null;
  }

  try {
    const session = await findActiveSession(sessionId);

    if (!session) {
      return null;
    }

    await ensureUserTable();
    const db = getDb();
    const [users] = await db.query<UserRow[]>(
      `SELECT id, name, email, role, is_active FROM users WHERE id = ? LIMIT 1`,
      [session.user_id],
    );

    if (!users.length) {
      return null;
    }

    const user = users[0];

    if (!user.is_active) {
      await revokeSession(session.id);
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: Boolean(user.is_active),
    } satisfies SessionUser;
  } catch (error) {
    console.error("Failed to resolve session", error);
    return null;
  }
});
