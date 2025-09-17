import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser, revokeSessionsForUser } from "lib/auth";
import { getAdminUserById, updateAdminUser } from "lib/users";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json(
        { message: "Acesso não autorizado." },
        { status: 403 },
      );
    }

    const userId = Number.parseInt(params.id, 10);

    if (Number.isNaN(userId)) {
      return NextResponse.json(
        { message: "Identificador de usuário inválido." },
        { status: 400 },
      );
    }

    const payload = await request.json().catch(() => ({}));
    const {
      name,
      email,
      role,
      password,
      balance,
      isActive,
      revokeSessions,
    } = payload as {
      name?: unknown;
      email?: unknown;
      role?: unknown;
      password?: unknown;
      balance?: unknown;
      isActive?: unknown;
      revokeSessions?: unknown;
    };

    const updates: {
      name?: string;
      email?: string;
      role?: "admin" | "user";
      password?: string;
      balance?: number;
      isActive?: boolean;
    } = {};

    if (typeof name === "string") {
      updates.name = name;
    }

    if (typeof email === "string") {
      updates.email = email;
    }

    if (role === "admin" || role === "user") {
      updates.role = role;
    }

    if (typeof password === "string") {
      updates.password = password;
    }

    if (typeof balance === "number" && Number.isFinite(balance) && balance >= 0) {
      updates.balance = balance;
    } else if (typeof balance === "string" && balance.trim().length > 0) {
      const parsed = Number.parseFloat(balance.replace(/,/g, "."));
      if (!Number.isNaN(parsed) && parsed >= 0) {
        updates.balance = parsed;
      }
    }

    if (typeof isActive === "boolean") {
      updates.isActive = isActive;
    }

    const hasUpdates = Object.keys(updates).length > 0;

    if (!hasUpdates && revokeSessions !== true) {
      return NextResponse.json(
        {
          message:
            "Informe os dados que deseja atualizar ou selecione para encerrar as sessões do usuário.",
        },
        { status: 400 },
      );
    }

    if (hasUpdates) {
      await updateAdminUser(userId, updates);
      if (updates.isActive === false) {
        await revokeSessionsForUser(userId);
      }
    }

    if (revokeSessions === true) {
      await revokeSessionsForUser(userId);
    }

    const updatedUser = await getAdminUserById(userId);

    if (!updatedUser) {
      return NextResponse.json(
        { message: "Usuário não encontrado." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      message: "Dados do usuário atualizados com sucesso.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Failed to update user", error);
    return NextResponse.json(
      { message: "Não foi possível atualizar o usuário." },
      { status: 500 },
    );
  }
}
