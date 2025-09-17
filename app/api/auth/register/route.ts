import bcrypt from "bcryptjs";
import type { ResultSetHeader } from "mysql2";
import { NextResponse } from "next/server";

import { ensureUserTable, getDb, UserRow } from "lib/db";
import { createAuthToken, setSessionCookie } from "lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, role } = body as {
      name?: string;
      email?: string;
      password?: string;
      role?: "admin" | "user";
    };

    if (!name || !email || !password) {
      return NextResponse.json(
        { message: "Nome, e-mail e senha são obrigatórios." },
        { status: 400 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedRole: "admin" | "user" = role === "admin" ? "admin" : "user";

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
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [name.trim(), normalizedEmail, hashedPassword, normalizedRole],
    );

    const userId = result.insertId;

    const token = createAuthToken({ userId, role: normalizedRole });
    const response = NextResponse.json(
      {
        user: {
          id: userId,
          name: name.trim(),
          email: normalizedEmail,
          role: normalizedRole,
        },
        message: "Conta criada com sucesso.",
      },
      { status: 201 },
    );

    setSessionCookie(response, token);

    return response;
  } catch (error) {
    console.error("Erro ao registrar usuário", error);
    return NextResponse.json(
      { message: "Não foi possível completar o registro." },
      { status: 500 },
    );
  }
}
