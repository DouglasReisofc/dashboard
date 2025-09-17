import { NextResponse } from "next/server";

import { clearSessionCookie } from "lib/auth";

export async function POST() {
  const response = NextResponse.json({ message: "Logout realizado com sucesso." });
  clearSessionCookie(response);
  return response;
}
