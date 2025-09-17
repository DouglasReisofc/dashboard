import bcrypt from "bcryptjs";
import type { ResultSetHeader } from "mysql2";
import { NextResponse } from "next/server";

import { ensureUserTable, getDb, UserRow } from "lib/db";
import { createSession, setSessionCookie } from "lib/auth";
import { ensureUserWebhook } from "lib/webhooks";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password } = body as {
      name?: string;
      email?: string;
      password?: string;
    };

    if (!name || !email || !password) {
      return NextResponse.json(
        { message: "Nome, e-mail e senha são obrigatórios." },
        { status: 400 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    await ensureUserTable();
    const db = getDb();

    const [existingUsers] = await db.query<UserRow[]>(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [normalizedEmail],
    );

    if (existingUsers.length) {
      return NextResponse.json(
        { message: "Este e-mail já está registrado." },
        { status: 409 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query<ResultSetHeader>(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'user')",
      [name.trim(), normalizedEmail, hashedPassword],
    );

    const userId = result.insertId;

    await ensureUserWebhook(userId);

    const session = await createSession(userId);
    const response = NextResponse.json(
      {
        user: {
          id: userId,
          name: name.trim(),
          email: normalizedEmail,
          role: "user",
          isActive: true,
        },
        message: "Conta criada com sucesso.",
      },
      { status: 201 },
    );

    setSessionCookie(response, session.id, session.expiresAt);

    return response;
  } catch (error) {
    console.error("Erro ao registrar usuário", error);
    return NextResponse.json(
      { message: "Não foi possível completar o registro." },
      { status: 500 },
    );
  }
}
