import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { ensureUserTable, getDb, UserRow } from "lib/db";
import { createAuthToken, setSessionCookie } from "lib/auth";

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

    const [users] = await db.query<UserRow[]>(
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

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { message: "Credenciais inválidas." },
        { status: 401 },
      );
    }

    const token = createAuthToken({ userId: user.id, role: user.role });
    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        message: "Login realizado com sucesso.",
      },
      { status: 200 },
    );

    setSessionCookie(response, token);

    return response;
  } catch (error) {
    console.error("Erro ao autenticar usuário", error);
    return NextResponse.json(
      { message: "Não foi possível completar o login." },
      { status: 500 },
    );
  }
}
