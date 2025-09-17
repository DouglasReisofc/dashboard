import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE, clearSessionCookie, revokeSession } from "lib/auth";

export async function POST() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (sessionId) {
    await revokeSession(sessionId);
  }

  const response = NextResponse.json({ message: "Logout realizado com sucesso." });
  clearSessionCookie(response);
  return response;
}
