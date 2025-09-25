import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { ensureUserTable, getDb, UserRow } from "lib/db";
import type { RowDataPacket } from "mysql2/promise";
import { createSession, normalizeUserRole, setSessionCookie } from "lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return NextResponse.json(
        { message: "Informe e-mail e senha válidos." },
        { status: 400 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    await ensureUserTable();
    const db = getDb();

    const [users] = await db.query<(UserRow & RowDataPacket)[]>(
      "SELECT * FROM users WHERE email = ? LIMIT 1",
      [normalizedEmail],
    );

    if (!users.length) {
      return NextResponse.json(
        { message: "Credenciais inválidas." },
        { status: 401 },
      );
    }

    const user = users[0];

    if (!user.is_active) {
      return NextResponse.json(
        {
          message:
            "Sua conta está desativada. Entre em contato com o suporte para reativação.",
        },
        { status: 403 },
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { message: "Credenciais inválidas." },
        { status: 401 },
      );
    }

    const session = await createSession(user.id);
    const normalizeAvatarUrl = (value: string | null) => {
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

    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: normalizeUserRole(user.role),
          isActive: Boolean(user.is_active),
          whatsappNumber: user.whatsapp_number ?? null,
          avatarUrl: normalizeAvatarUrl(user.avatar_path ?? null),
        },
        message: "Login realizado com sucesso.",
      },
      { status: 200 },
    );

    setSessionCookie(response, session.id, session.expiresAt);

    return response;
  } catch (error) {
    console.error("Erro ao autenticar usuário", error);
    return NextResponse.json(
      { message: "Não foi possível completar o login." },
      { status: 500 },
    );
  }
}
