import bcrypt from "bcryptjs";
import type { ResultSetHeader } from "mysql2";
import { NextResponse } from "next/server";

import { ensureUserTable, getDb, UserRow } from "lib/db";
import type { RowDataPacket } from "mysql2/promise";
import { createSession, setSessionCookie } from "lib/auth";
import { ensureUserWebhook } from "lib/webhooks";
import { sendWelcomeEmail } from "lib/notifications";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      email,
      password,
      whatsappDialCode,
      whatsappNumber,
    } = body as {
      name?: string;
      email?: string;
      password?: string;
      whatsappDialCode?: string;
      whatsappNumber?: string;
    };

    if (!name || !email || !password) {
      return NextResponse.json(
        { message: "Nome, e-mail e senha são obrigatórios." },
        { status: 400 },
      );
    }

    const dialCodeRaw = typeof whatsappDialCode === "string" ? whatsappDialCode.trim() : "";
    const numberRaw = typeof whatsappNumber === "string" ? whatsappNumber.trim() : "";

    if (!dialCodeRaw || !numberRaw) {
      return NextResponse.json(
        { message: "Informe o número do WhatsApp." },
        { status: 400 },
      );
    }

    const sanitizedDialCode = dialCodeRaw.startsWith("+") ? dialCodeRaw : `+${dialCodeRaw}`;
    const digitsOnly = numberRaw.replace(/[^0-9]/g, "");

    if (digitsOnly.length < 8 || digitsOnly.length > 15) {
      return NextResponse.json(
        { message: "Informe um número de WhatsApp válido (inclua DDD e número)." },
        { status: 400 },
      );
    }

    const whatsappFullNumber = `${sanitizedDialCode}${digitsOnly}`;
    if (whatsappFullNumber.length > 25) {
      return NextResponse.json(
        { message: "Número de WhatsApp excede o tamanho permitido." },
        { status: 400 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    await ensureUserTable();
    const db = getDb();

    const [existingUsers] = await db.query<(UserRow & RowDataPacket)[]>(
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
      "INSERT INTO users (name, email, password, role, whatsapp_number) VALUES (?, ?, ?, 'user', ?)",
      [name.trim(), normalizedEmail, hashedPassword, whatsappFullNumber],
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
          whatsappNumber: whatsappFullNumber,
          avatarUrl: null,
        },
        message: "Conta criada com sucesso.",
      },
      { status: 201 },
    );

    setSessionCookie(response, session.id, session.expiresAt);

    await sendWelcomeEmail({
      userId,
      userName: name.trim(),
      userEmail: normalizedEmail,
    });

    return response;
  } catch (error) {
    console.error("Erro ao registrar usuário", error);
    return NextResponse.json(
      { message: "Não foi possível completar o registro." },
      { status: 500 },
    );
  }
}
