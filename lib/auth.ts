import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ensureUserTable, getDb, UserRow } from "lib/db";
import type { SessionUser } from "types/auth";

export const SESSION_COOKIE = "sb_session";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET is not defined. Please set it in your environment variables.",
  );
}

type TokenPayload = {
  userId: number;
  role: "admin" | "user";
};

export const createAuthToken = (payload: TokenPayload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
};

export const verifyAuthToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
};

const baseCookieConfig = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export const setSessionCookie = (response: NextResponse, token: string) => {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    maxAge: 60 * 60 * 24 * 7,
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

export const getCurrentUser = async (): Promise<SessionUser | null> => {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const payload = verifyAuthToken(token);
    const db = getDb();
    await ensureUserTable();
    const [rows] = await db.query<UserRow[]>(
      "SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1",
      [payload.userId],
    );

    if (!rows.length) {
      return null;
    }

    const user = rows[0];

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  } catch (error) {
    console.error("Failed to verify session", error);
    return null;
  }
};
